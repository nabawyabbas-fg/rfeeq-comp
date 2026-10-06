import type { MyUIMessage } from "@/types/ai";
import type { ModelMessage, ToolSet } from "ai";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  smoothStream,
  stepCountIs,
  streamText,
} from "ai";

import type { NamespaceLanguageModel } from "@agentset/engine";

import type { AgenticToolContext } from "./tools";
import { languageDirective, questionLanguage } from "./language";
import { LanguageGate } from "./language-gate";
import { MetricsCollector } from "./metrics";
import { resolveSystemPrompt } from "./prompts";
import { agenticTools } from "./tools";

export type { AgenticToolContext, SearchToolConfig } from "./tools";
export {
  AGENTIC_SYSTEM_PROMPT,
  isKnownDefaultPrompt,
  resolveSystemPrompt,
} from "./prompts";

// stop after 20 steps
const MAX_STEPS = 20;

type AgenticSearchPipelineOptions = {
  languageModel: NamespaceLanguageModel;
  /**
   * Optional separate model for choosing search queries.
   *
   * Retrieval quality and writing quality are different jobs and the evaluation
   * separates cleanly on them: Gemini 3.7 Flash searches well and cites
   * faultlessly, while the Lite models are an order of magnitude cheaper but
   * search shallowly — a single query where 3.7 Flash issues several. Splitting
   * lets the expensive model decide what to look for while a cheaper one writes
   * from what it found.
   */
  extractionModel?: NamespaceLanguageModel;
  /**
   * Raw stored/user-supplied prompt; resolved via resolveSystemPrompt (pass
   * the stored value as-is, don't pre-default it). Default-shaped prompts run
   * the tuned agentic prompt; custom prompts get the platform tool and
   * citation contract appended.
   */
  systemPrompt?: string | null;
  messages: ModelMessage[];
  context: AgenticToolContext;
  temperature?: number;
  headers?: HeadersInit;
  /** aborts the run when the client disconnects or hits stop */
  abortSignal?: AbortSignal;
  /** called with the total number of vector store queries when the run ends */
  afterRun?: (totalQueries: number) => void;
  /** identifiers used only to price the run; absent means cost shows as "—" */
  modelId?: string;
  /** priced separately from the generation model when they differ */
  extractionModelId?: string;
  embeddingModelId?: string;
  /**
   * Whether this run has a knowledge base to search.
   *
   * False for the Rfeeq consumer surface, which retrieves live from the
   * challenge's approved platforms and has no ingested corpus at all. The
   * built-in `search` and `expand` tools are then not offered — a tool the run
   * cannot use is a tool it will eventually try — and `context` may carry empty
   * stores.
   */
  useKnowledgeBase?: boolean;
  /**
   * Extra retrieval tools, merged alongside `search` and `expand`.
   *
   * How the Rfeeq surface reaches the challenge's approved platforms: those are
   * live read-only APIs rather than an ingested corpus, so they arrive as tools
   * the model may call, chosen per request by the question's intent. Merged
   * rather than replacing, because a run commonly needs both — a hadith's
   * grading from the approved encyclopedia and its discussion from the books.
   */
  extraTools?: ToolSet;
};

/**
 * Agentic search chat: the model drives retrieval through the `search` and
 * `expand` tools until it can answer, then streams a grounded response.
 */
export const agenticSearchPipeline = ({
  languageModel,
  extractionModel,
  systemPrompt,
  messages,
  context,
  temperature,
  headers,
  abortSignal,
  afterRun,
  modelId,
  extractionModelId,
  embeddingModelId,
  extraTools,
  useKnowledgeBase = true,
}: AgenticSearchPipelineOptions) => {
  let totalQueries = 0;
  const metrics = new MetricsCollector(
    modelId ?? "unknown",
    embeddingModelId ?? "unknown",
    extractionModelId ?? modelId ?? "unknown",
  );
  const toolContext: AgenticToolContext = {
    ...context,
    metrics,
    onQuery: () => {
      totalQueries++;
    },
  };
  let lastStepAt = Date.now();

  // Computed here rather than left to the model. The prompt has always told it
  // to answer in the user's language and it still answers Arabic questions in
  // English; naming the language removes the inference.
  const expectedLanguage = questionLanguage(messages);
  const lockedSystem =
    resolveSystemPrompt(systemPrompt, { useKnowledgeBase }) +
    languageDirective(expectedLanguage);

  // meter usage exactly once, whether the run finishes or is aborted
  let ranAfterRun = false;
  const finishRun = () => {
    if (ranAfterRun) return;
    ranAfterRun = true;
    afterRun?.(totalQueries);
  };

  /**
   * One generation attempt. Passing `retryContext` replays the tool calls and
   * results from the previous attempt, so the model rewrites from the same
   * evidence instead of searching again — the citations already streamed to the
   * reader stay valid, and the retry costs one generation rather than a run.
   */
  const REWRITE_TURN: ModelMessage = {
    role: "user",
    content:
      "Your previous attempt was written in the wrong language and was discarded before the reader saw it. Write the answer again in full, in the language required above, using only the passages already retrieved. Do not search again.",
  };

  const generate = (retryContext?: ModelMessage[]) =>
    streamText({
      model: languageModel.model,
      system: lockedSystem,
      /*
       * The rewrite instruction is a **user turn**, not a system block.
       *
       * Gemini rejects a request whose last message is a model turn —
       * "Requests ending with a model turn are not supported" — and
       * `retryContext` is precisely the previous attempt's assistant output, so
       * replaying it alone produced a 400 and the reader saw nothing at all.
       * Putting the instruction in a closing user turn fixes the shape and
       * also places it adjacent to generation, which is the same argument this
       * pipeline already makes for re-asserting the language on every step.
       */
      messages: retryContext
        ? [...messages, ...retryContext, REWRITE_TURN]
        : messages,
      tools: useKnowledgeBase
        ? extraTools
          ? { ...agenticTools, ...extraTools }
          : agenticTools
        : (extraTools ?? {}),
      activeTools: retryContext
        ? [] // nothing left to retrieve on a rewrite
        : !useKnowledgeBase
          ? undefined // only the live source tools are offered in the first place
          : // expand needs an ordered range fetch, which not all stores support
            context.vectorStores.every((s) => s.supportsOrderedQuery())
            ? undefined
            : ["search"],
      providerOptions: languageModel.providerOptions,
      // temperature is ignored (stripped by the SDK) for reasoning models
      temperature,
      onStepFinish: ({ usage }) => {
        const now = Date.now();
        metrics.recordStep(usage, now - lastStepAt);
        lastStepAt = now;
      },
      prepareStep: ({ stepNumber }) => ({
        /*
         * Step 0 is the only step guaranteed to be a search — toolChoice forces
         * it — so it is the one that can be handed to a different model without
         * risking the answer being written by it. Later steps may search or may
         * write, and there is no way to know which in advance, so they stay on
         * the generation model.
         */
        ...(extractionModel && !retryContext && stepNumber === 0
          ? { model: extractionModel.model }
          : {}),
        // Require a tool call on the first step of a user turn. The prompt
        // instructs the model never to answer from its own knowledge, but an
        // agentic loop only *offers* retrieval — nothing enforces it, and Gemini
        // would otherwise go straight to prose. Not applied on a rewrite, which
        // must not search at all.
        ...(!retryContext &&
        stepNumber === 0 &&
        messages.at(-1)?.role === "user"
          ? { toolChoice: "required" as const }
          : {}),
        // Re-assert the language on every later step. By the time the answer is
        // written the instruction is thousands of tokens back and buried under
        // retrieved passages; repeating it puts it adjacent to generation.
        ...(stepNumber > 0 ? { system: lockedSystem } : {}),
      }),
      stopWhen: stepCountIs(MAX_STEPS),
      // Reasoning models spend part of this budget thinking, and Arabic
      // tokenises at roughly 1.3 characters per token, so a cited answer of a
      // few thousand words needs considerably more headroom than 5k.
      maxOutputTokens: 16000,
      experimental_transform: smoothStream({ chunking: "word" }),
      experimental_context: toolContext,
      abortSignal,
      onAbort: finishRun,
      onFinish: finishRun,
      onError: (error) => {
        console.error(error);
      },
    });

  /** Shared stream options. Typed through the call so the chunk type stays
   *  MyUIMessage — hoisting the options object alone widens it to unknown. */
  const toUi = (result: ReturnType<typeof generate>) =>
    result.toUIMessageStream<MyUIMessage>({
      sendReasoning: true,
      // attached once the run settles, so the UI can render the breakdown
      messageMetadata: ({ part }) =>
        part.type === "finish" ? { metrics: metrics.finish() } : undefined,
      // don't leak raw provider/tool error messages to the client
      onError: (error) => {
        console.error(error);
        return "An error occurred";
      },
    });

  const stream = createUIMessageStream<MyUIMessage>({
    execute: async ({ writer }) => {
      const first = generate();
      // Holds the prose back until its language is known. Search progress and
      // reasoning stream through untouched, so the UI still shows activity.
      const gate = new LanguageGate(expectedLanguage, writer);

      for await (const part of toUi(first)) {
        if (!gate.handle(part)) break; // wrong language: stop, nothing shown
      }

      if (!gate.rejected) {
        gate.finish();
        return;
      }

      // Rewrite from the evidence already retrieved. Only the prose is
      // regenerated; the tool parts the reader has already seen remain the ones
      // the new citations refer to. The rewrite is not gated, so a second
      // failure is shown rather than looping indefinitely.
      const prior = (await first.response).messages;
      for await (const part of toUi(generate(prior))) {
        // The discarded attempt already opened the message. Letting the rewrite
        // open a second one would leave the client with two starts for a single
        // answer.
        if ((part as { type?: string }).type === "start") continue;
        writer.write(part);
      }
    },
    onError(error) {
      console.error(error);
      return "An error occurred";
    },
  });

  return createUIMessageStreamResponse({ stream, headers });
};
