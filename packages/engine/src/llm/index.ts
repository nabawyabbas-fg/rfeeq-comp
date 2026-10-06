import { createAzure } from "@ai-sdk/azure";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI, OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import { LanguageModel } from "ai";

import { DEFAULT_LLM, LLM } from "@agentset/validation";

import { env } from "../env";

const openaiAzure = createAzure({
  apiKey: env.DEFAULT_AZURE_API_KEY,
  resourceName: env.DEFAULT_AZURE_RESOURCE_NAME,
});

/**
 * Azure remains the default path. When OPENAI_API_KEY is set we talk to OpenAI
 * directly instead — the same models behind the same Responses API, so nothing
 * downstream changes. Azure needs deployment names (`gpt-5-chat`), OpenAI wants
 * the plain model id, which is the only reason the id differs between them.
 */
const openaiDirect = env.OPENAI_API_KEY
  ? createOpenAI({ apiKey: env.OPENAI_API_KEY })
  : null;

const google = env.GOOGLE_API_KEY
  ? createGoogleGenerativeAI({ apiKey: env.GOOGLE_API_KEY })
  : null;

/**
 * OpenRouter is OpenAI-compatible, so the OpenAI provider works against it with
 * a different base URL. It exposes chat-completions rather than the Responses
 * API, so these models are constructed with the callable form rather than
 * `.responses()`.
 */
const openrouter = env.OPENROUTER_API_KEY
  ? createOpenAI({
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
    })
  : null;

// this maps the model names to the actual model IDs in azure
const modelToId: Partial<Record<LLM, string>> = {
  "openai:gpt-4.1": "gpt-4.1",
  "openai:gpt-5": "gpt-5-chat",
  "openai:gpt-5.1": "gpt-5.1-chat",
  "openai:gpt-5.2": "gpt-5.2-chat",
  "openai:gpt-5.5": "gpt-5.5",
  "openai:gpt-5-mini": "gpt-5-mini",
  "openai:gpt-5-nano": "gpt-5-nano",
};

// models that expose reasoning through the Azure Responses API. For those we
// round-trip encrypted reasoning between the steps of an agentic loop.
const REASONING_MODELS = new Set<LLM>(["openai:gpt-5.5"]);

export type NamespaceLanguageModel = {
  model: LanguageModel;
  providerOptions?:
    | { openai: OpenAIResponsesProviderOptions }
    | { google: { thinkingConfig: { thinkingBudget: number } } };
};

/**
 * Gemini counts thinking tokens against maxOutputTokens, so an unbounded
 * thinking budget can consume the whole allowance and truncate the answer
 * mid-sentence. Capping it leaves the bulk of the budget for the response.
 */
const GEMINI_THINKING_BUDGET = 4096;

/**
 * All models go through the Azure Responses API — the chat-completions path
 * breaks on some chat deployments (e.g. `gpt-5-chat` rejects `max_tokens`).
 * For reasoning models we additionally request encrypted reasoning with
 * `store: false`, so the reasoning content can be replayed on follow-up steps
 * of an agentic loop.
 */
export const getNamespaceLanguageModel = (
  model: LLM = DEFAULT_LLM,
): NamespaceLanguageModel => {
  const [providerName, plainModelId] = model.split(":");

  if (providerName === "openrouter") {
    if (!openrouter) {
      throw new Error(
        `OPENROUTER_API_KEY is not configured, cannot use model ${model}`,
      );
    }
    // model ids contain a slash (e.g. moonshotai/kimi-k3), so rejoin whatever
    // split() separated after the provider prefix
    return { model: openrouter(model.slice("openrouter:".length)) };
  }

  if (providerName === "google") {
    if (!google) {
      throw new Error(
        `GOOGLE_API_KEY is not configured, cannot use model ${model}`,
      );
    }

    // Gemini has no equivalent of the Responses API's encrypted-reasoning
    // replay; instead we bound its thinking so it cannot eat the output budget.
    return {
      model: google(plainModelId!),
      providerOptions: {
        google: { thinkingConfig: { thinkingBudget: GEMINI_THINKING_BUDGET } },
      },
    };
  }

  const provider = openaiDirect ?? openaiAzure;
  const modelId = openaiDirect ? plainModelId! : modelToId[model];
  if (!modelId) {
    throw new Error(`No deployment mapping for model ${model}`);
  }

  return {
    model: provider.responses(modelId),
    ...(REASONING_MODELS.has(model) && {
      providerOptions: {
        openai: {
          store: false,
          include: ["reasoning.encrypted_content"],
        } satisfies OpenAIResponsesProviderOptions,
      },
    }),
  };
};
