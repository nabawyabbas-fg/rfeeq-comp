import type { SearchToolConfig } from "@/lib/agentic-search/tools";
import { agenticSearchPipeline } from "@/lib/agentic-search";
import { corpusPromptFor } from "@/lib/agentic-search/corpus-prompts";
import { agenticTools } from "@/lib/agentic-search/tools";
import { AgentsetApiError } from "@/lib/api/errors";
import { withAuthApiHandler } from "@/lib/api/handler";
import { parseRequestBody } from "@/lib/api/utils";
import { waitUntil } from "@vercel/functions";
import { convertToModelMessages, pruneMessages } from "ai";

import { db } from "@agentset/db/client";
import {
  getNamespaceEmbeddingModel,
  getNamespaceLanguageModel,
  getNamespaceVectorStore,
} from "@agentset/engine";
import { DEFAULT_LLM } from "@agentset/validation";

import { chatSchema } from "./schema";

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
          totalPlaygroundUsage: { increment: 1 },
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

export const preferredRegion = "iad1"; // make this closer to the DB
export const maxDuration = 300; // agentic runs can take multiple tool-calling steps

export const POST = withAuthApiHandler(
  async ({ req, namespace, tenantId, headers }) => {
    const body = await chatSchema.parseAsync(await parseRequestBody(req));

    if (body.messages.length === 0) {
      throw new AgentsetApiError({
        code: "bad_request",
        message: "Messages must contain at least one message",
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

    const languageModel = getNamespaceLanguageModel(body.llmModel);
    // Choosing the searches and writing the answer are different jobs; the
    // playground defaults to the same split the hosted sites use so what is
    // tested here matches what ships.
    const extractionModelId = body.extractionModel ?? DEFAULT_EXTRACTION_MODEL;
    const extractionModel = getNamespaceLanguageModel(extractionModelId);

    // An additional corpus may only be another namespace in the same
    // organization; without that check these fields would read across tenants.
    const loadCorpus = async (id?: string) =>
      id
        ? await db.namespace.findFirst({
            where: { id, organizationId: namespace.organizationId },
            select: {
              id: true,
              name: true,
              vectorStoreConfig: true,
              corpusProfile: true,
            },
          })
        : null;

    const [secondary, tertiary] =
      body.retrievalMode === "PRIMARY"
        ? [null, null]
        : await Promise.all([
            loadCorpus(body.secondaryNamespaceId),
            loadCorpus(body.tertiaryNamespaceId),
          ]);

    // Each standalone mode needs its own corpus present; BOTH needs at least
    // one companion to pool with, or it would silently degrade to PRIMARY and
    // the comparison pane would show the primary answer twice.
    const required =
      body.retrievalMode === "SECONDARY"
        ? secondary
        : body.retrievalMode === "TERTIARY"
          ? tertiary
          : body.retrievalMode === "BOTH"
            ? (secondary ?? tertiary)
            : namespace;

    if (!required) {
      throw new AgentsetApiError({
        code: "not_found",
        message: `Namespace for retrieval mode ${body.retrievalMode} not found in this organization`,
      });
    }

    const corpora =
      body.retrievalMode === "SECONDARY"
        ? [secondary!]
        : body.retrievalMode === "TERTIARY"
          ? [tertiary!]
          : body.retrievalMode === "BOTH"
            ? [namespace, secondary, tertiary].filter((n) => n !== null)
            : [namespace];

    const [vectorStores, embeddingModel] = await Promise.all([
      Promise.all(corpora.map((n) => getNamespaceVectorStore(n, tenantId))),
      // every corpus here is embedded with the same model, so the query is
      // embedded with this namespace's regardless of which are searched
      getNamespaceEmbeddingModel(namespace, "query"),
    ]);

    // accurate: rerank semantic searches (fetch topK, keep rerankLimit)
    // fast: skip reranking and fetch fewer chunks
    const rerankLimit = Math.min(body.rerankLimit, body.topK);
    const searchConfig: SearchToolConfig =
      body.mode === "fast"
        ? {
            topK: rerankLimit,
            keywordTopK: rerankLimit,
            rerank: false,
          }
        : {
            topK: body.topK,
            keywordTopK: rerankLimit,
            rerank: { model: body.rerankModel, limit: rerankLimit },
          };

    return agenticSearchPipeline({
      modelId: body.llmModel ?? DEFAULT_LLM,
      embeddingModelId: namespace.embeddingConfig?.model,
      languageModel,
      extractionModel,
      extractionModelId,
      // Each pane of a comparison searches a different corpus, so the prompt
      // follows the corpus rather than the pane's position: the Fatwas pane is
      // no longer told to write classical-Arabic bāb headings. An explicit
      // prompt from the client still wins.
      systemPrompt: body.systemPrompt ?? corpusPromptFor(corpora),
      messages,
      temperature: body.temperature,
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
      abortSignal: req.signal,
      afterRun: (totalQueries) => {
        incrementUsage(namespace.id, Math.max(totalQueries, 1));
      },
      headers,
    });
  },
);
