import type { SearchToolConfig } from "@/lib/agentic-search/tools";
import { agenticSearchPipeline } from "@/lib/agentic-search";
import { corpusPromptFor } from "@/lib/agentic-search/corpus-prompts";
import { agenticTools } from "@/lib/agentic-search/tools";
import { AgentsetApiError, exceededLimitError } from "@/lib/api/errors";
import { withPublicApiHandler } from "@/lib/api/handler/public";
import { hostingAuth } from "@/lib/api/hosting-auth";
import { ratelimit } from "@/lib/api/rate-limit";
import { parseRequestBody } from "@/lib/api/utils";
import { withAnswerDepth } from "@/lib/rfeeq/answer-depth";
import { routeQuestion } from "@/lib/rfeeq/intent";
import { sourceToolsFor } from "@/lib/rfeeq/sources/tools";
import { waitUntil } from "@vercel/functions";
import { convertToModelMessages, pruneMessages } from "ai";

import { db } from "@agentset/db/client";
import {
  getNamespaceEmbeddingModel,
  getNamespaceLanguageModel,
  getNamespaceVectorStore,
} from "@agentset/engine";
import { INFINITY_NUMBER } from "@agentset/utils";
import { DEFAULT_LLM } from "@agentset/validation";

import { hostingChatSchema } from "./schema";

/** Chooses the search queries. Retrieval and writing are different jobs, and
 *  this model writes markedly better classical-Arabic queries than the cheaper
 *  ones. Only the first step runs on it. */
const DEFAULT_EXTRACTION_MODEL = "google:gemini-3.7-flash" as const;

const incrementUsage = (namespaceId: string, queries: number) => {
  waitUntil(
    (async () => {
      // track usage
      await db.namespace.update({
        where: {
          id: namespaceId,
        },
        data: {
          organization: {
            update: {
              searchUsage: { increment: queries },
            },
          },
        },
      });
    })(),
  );
};

const getHosting = async (namespaceId: string) => {
  return db.hosting.findFirst({
    where: {
      namespaceId,
    },
    select: {
      id: true,
      systemPrompt: true,
      rerankConfig: true,
      llmConfig: true,
      extractionConfig: true,
      topK: true,
      retrievalMode: true,
      secondaryNamespace: {
        // name and corpusProfile feed the corpus-matched system prompt
        select: {
          id: true,
          name: true,
          vectorStoreConfig: true,
          corpusProfile: true,
        },
      },
      protected: true,
      allowedEmails: true,
      allowedEmailDomains: true,
      namespace: {
        select: {
          id: true,
          name: true,
          vectorStoreConfig: true,
          corpusProfile: true,
          embeddingConfig: true,
          organization: {
            select: {
              plan: true,
              searchUsage: true,
              searchLimit: true,
            },
          },
        },
      },
    },
  });
};

export const preferredRegion = "iad1"; // make this closer to the DB
export const maxDuration = 300; // agentic runs can take multiple tool-calling steps

export const POST = withPublicApiHandler(
  async ({ req, searchParams, headers }) => {
    const body = await hostingChatSchema.parseAsync(
      await parseRequestBody(req),
    );

    if (body.messages.length === 0 || body.messages.length > 50) {
      throw new AgentsetApiError({
        code: "bad_request",
        message: "Messages must contain between 1 and 50 messages",
      });
    }

    const converted = convertToModelMessages(body.messages, {
      tools: agenticTools,
      ignoreIncompleteToolCalls: true,
    });
    // tool results and reasoning from previous turns don't inform future
    // answers (the model re-searches); prune them to keep the context small.
    // Continuation payloads (trailing assistant/tool messages) are left
    // untouched: their kept tool calls need the paired reasoning items for
    // the Responses API replay.
    const messages =
      converted.at(-1)?.role === "user"
        ? pruneMessages({
            messages: converted,
            reasoning: "before-last-message",
            toolCalls: "before-last-message",
          })
        : converted;

    const namespaceId = searchParams.namespaceId;
    if (!namespaceId) {
      throw new AgentsetApiError({
        code: "bad_request",
        message: "Namespace ID is required",
      });
    }

    const hosting = await getHosting(namespaceId);
    if (!hosting) {
      throw new AgentsetApiError({
        code: "not_found",
        message: "Hosting not found",
      });
    }

    await hostingAuth(req, hosting);

    // this is an anonymous surface: rate limit per visitor IP
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const { success } = await ratelimit(30, "1 m").limit(
      `hosting-chat:${hosting.id}:${ip}`,
    );
    if (!success) {
      throw new AgentsetApiError({
        code: "rate_limit_exceeded",
        message: "Too many requests.",
      });
    }

    // block orgs that already exceeded their retrieval quota
    const organization = hosting.namespace.organization;
    if (
      INFINITY_NUMBER !== organization.searchLimit &&
      organization.searchUsage >= organization.searchLimit
    ) {
      throw new AgentsetApiError({
        code: "rate_limit_exceeded",
        message: exceededLimitError({
          plan: organization.plan,
          limit: organization.searchLimit,
          type: "retrievals",
        }),
      });
    }

    const chosenModel = body.llmModel ?? hosting.llmConfig?.model;
    const languageModel = getNamespaceLanguageModel(chosenModel);
    // retrieval and writing are different jobs; a site may pay for a stronger
    // model to choose the searches and a cheaper one to write the answer
    // request override, then the site's setting, then the default
    const extractionModelId =
      body.extractionModel ??
      hosting.extractionConfig?.model ??
      DEFAULT_EXTRACTION_MODEL;
    const extractionModel = getNamespaceLanguageModel(extractionModelId);

    // Which corpora this site searches. SECONDARY and BOTH need a second
    // namespace to have been picked; without one they fall back to the site's
    // own namespace rather than searching nothing.
    const secondary = hosting.secondaryNamespace;
    const corpora =
      secondary && hosting.retrievalMode !== "PRIMARY"
        ? hosting.retrievalMode === "SECONDARY"
          ? [secondary]
          : [hosting.namespace, secondary]
        : [hosting.namespace];

    const [vectorStores, embeddingModel] = await Promise.all([
      Promise.all(corpora.map((n) => getNamespaceVectorStore(n))),
      // both corpora are embedded with the same model, so the query is embedded
      // with the site namespace's model regardless of which ones are searched
      getNamespaceEmbeddingModel(hosting.namespace, "query"),
    ]);

    const rerankLimit = Math.min(
      hosting.rerankConfig?.limit ?? 15,
      hosting.topK,
    );
    const searchConfig: SearchToolConfig = {
      topK: hosting.topK,
      keywordTopK: rerankLimit,
      rerank: { model: hosting.rerankConfig?.model, limit: rerankLimit },
    };

    /*
     * Which approved platforms this question may reach.
     *
     * Classified from the question itself, not from the corpus: the allow-list
     * is organised by domain (القرآن، الحديث، المصطلحات …) and a question's
     * domain is a property of the question. A model cannot misuse a tool it was
     * not given, so gating here is stronger than instructing.
     *
     * Only the last user turn is classified. A follow-up inherits nothing —
     * «وما الدليل؟» after a hadith question is its own question, and letting an
     * earlier turn widen the available sources is how an allow-list leaks.
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
    const extraTools = routing ? sourceToolsFor(routing.intent) : {};

    return agenticSearchPipeline({
      languageModel,
      extractionModel,
      extractionModelId,
      // The corpus-matched prompt, chosen by the same retrievalMode that chose
      // `corpora` above, so the instructions always describe what is actually
      // being searched. A prompt stored on the site still wins — it is an
      // explicit override — but a site that never set one no longer inherits
      // classical-Arabic query rules while searching contemporary fatwas.
      // The reader's depth preference rides on top of whichever prompt was
      // chosen — including a site's own override, since the preference is
      // about presentation and the override is about the corpus.
      systemPrompt: withAnswerDepth(
        hosting.systemPrompt ?? corpusPromptFor(corpora),
        body.answerDepth,
      ),
      messages,
      context: {
        /*
         * Only the classical corpus carries bookId, so only it can honour a
         * scoped search. `some` rather than `every`: in a pooled run the
         * classical half answers the restriction and the others contribute
         * nothing, which is the right reading of "only from this book". When
         * no corpus can, the tool says so instead of searching unscoped.
         */
        supportsScope: corpora.some((n) => n.corpusProfile === "CLASSICAL"),
        vectorStores,
        embeddingModel,
        search: searchConfig,
      },
      modelId: chosenModel ?? DEFAULT_LLM,
      embeddingModelId: hosting.namespace.embeddingConfig?.model,
      // the live allow-listed sources, chosen by intent above
      extraTools,
      abortSignal: req.signal,
      afterRun: (totalQueries) => {
        incrementUsage(hosting.namespace.id, Math.max(totalQueries, 1));
      },
      headers,
    });
  },
);
