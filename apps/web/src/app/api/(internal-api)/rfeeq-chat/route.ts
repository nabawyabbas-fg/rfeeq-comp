import { agenticSearchPipeline } from "@/lib/agentic-search";
import { AgentsetApiError } from "@/lib/api/errors";
import { withPublicApiHandler } from "@/lib/api/handler/public";
import { ratelimit } from "@/lib/api/rate-limit";
import { parseRequestBody } from "@/lib/api/utils";
import { withAnswerDepth } from "@/lib/rfeeq/answer-depth";
import { withExpertise } from "@/lib/rfeeq/expertise";
import { routeQuestion } from "@/lib/rfeeq/intent";
import { RFEEQ_SYSTEM_PROMPT } from "@/lib/rfeeq/prompt";
import { sourceToolsFor } from "@/lib/rfeeq/sources/tools";
import { convertToModelMessages, pruneMessages } from "ai";

import { getNamespaceLanguageModel } from "@agentset/engine";

import { rfeeqChatSchema } from "./schema";

/**
 * The Rfeeq consumer chat.
 *
 * Its own route rather than the hosting one, because it retrieves differently:
 * there is no ingested corpus here and no `Hosting` row to configure one. Every
 * passage comes live from the challenge's approved platforms, chosen by the
 * question's intent, and the allow-list is enforced at the socket.
 *
 * That also removes the dependency that made this surface untestable — the
 * hosting endpoint 404s without a namespace, so the UI had to disable itself
 * until a corpus was ingested. Nothing needs ingesting now.
 */

/** Agentic runs take several tool-calling steps, and a web search is slow. */
export const maxDuration = 300;
export const preferredRegion = "iad1";

/** Writes well in Arabic and calls tools reliably. */
const MODEL = "google:gemini-3.7-flash" as const;

export const POST = withPublicApiHandler(async ({ req, headers }) => {
  const body = await rfeeqChatSchema.parseAsync(await parseRequestBody(req));

  if (body.messages.length === 0 || body.messages.length > 50) {
    throw new AgentsetApiError({
      code: "bad_request",
      message: "Messages must contain between 1 and 50 messages",
    });
  }

  // anonymous surface: metered per visitor, since there is no account to meter
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success } = await ratelimit(20, "1 m").limit(`rfeeq-chat:${ip}`);
  if (!success) {
    throw new AgentsetApiError({
      code: "rate_limit_exceeded",
      message: "Too many requests.",
    });
  }

  const converted = convertToModelMessages(body.messages, {
    ignoreIncompleteToolCalls: true,
  });
  // tool results and reasoning from earlier turns do not inform later answers —
  // the model re-retrieves — so pruning them keeps the context small
  const messages =
    converted.at(-1)?.role === "user"
      ? pruneMessages({
          messages: converted,
          reasoning: "before-last-message",
          toolCalls: "before-last-message",
        })
      : converted;

  /*
   * Which approved platforms this question may reach, from the question itself.
   *
   * Only the last user turn is classified. A follow-up inherits nothing — «وما
   * الدليل؟» after a hadith question is its own question, and letting an earlier
   * turn widen the available sources is how an allow-list leaks.
   */
  const lastUserText = (() => {
    for (let i = body.messages.length - 1; i >= 0; i--) {
      const message = body.messages[i];
      if (message?.role !== "user") continue;
      for (const part of message.parts) {
        if (part.type === "text" && part.text.trim()) return part.text;
      }
    }
    return "";
  })();

  const routing = lastUserText ? routeQuestion(lastUserText) : null;
  const tools = routing
    ? sourceToolsFor(routing.intent, body.expertise)
    : {};

  return agenticSearchPipeline({
    languageModel: getNamespaceLanguageModel(MODEL),
    systemPrompt: withExpertise(
      withAnswerDepth(
        RFEEQ_SYSTEM_PROMPT(routing, lastUserText),
        body.answerDepth,
      ),
      body.expertise,
    ),
    messages,
    // nothing is ingested: the live source tools are the whole of retrieval
    useKnowledgeBase: false,
    extraTools: tools,
    context: {
      vectorStores: [],
      embeddingModel: null as never,
      search: { topK: 0, keywordTopK: 0, rerank: { limit: 0 } },
      supportsScope: false,
    },
    modelId: MODEL,
    abortSignal: req.signal,
    headers,
  });
});
