import type { EmbeddingModel, ToolSet } from "ai";
import { tool } from "ai";
import { z } from "zod/v4";

import type { VectorStore } from "@agentset/engine";
import type { RerankingModel } from "@agentset/validation";
import { expandChunk } from "@agentset/engine";

import type { ScopeResult } from "./corpus-scope";
import type { FormattedChunk } from "./format-chunk";
import type { MetricsCollector } from "./metrics";
import { resolveAuthorScope, resolveBookScope } from "./corpus-scope";
import { formatChunk, formatChunkForModel } from "./format-chunk";
import { queryStores } from "./retrieval";

export type SearchToolConfig = {
  /** how many chunks to fetch for a semantic search (pre-rerank) */
  topK: number;
  /** how many chunks to fetch for a keyword search (never reranked) */
  keywordTopK: number;
  /** reranking for semantic searches; `false` disables it (fast mode) */
  rerank: false | { model?: RerankingModel; limit: number };
};

// passed out-of-band to the tools via `experimental_context`, so the model
// can't influence retrieval configuration
export type AgenticToolContext = {
  /** Collects per-stage cost and latency for this answer. */
  metrics?: MetricsCollector;
  /**
   * The corpora to search, in priority order. More than one entry means the
   * site is configured to draw on several collections; see `queryStores` for
   * how their results are combined.
   */
  vectorStores: VectorStore[];
  embeddingModel: EmbeddingModel;
  search: SearchToolConfig;
  /**
   * Whether the corpora being searched carry book metadata, i.e. whether a
   * scoped search can be honoured at all. Only the classical corpus does — the
   * fatwa and encyclopedia payloads have no `bookId`, so a scope there is
   * reported unsupported rather than quietly ignored. Quietly ignoring it is
   * how a pane answered a question about a dictionary it does not contain.
   */
  supportsScope: boolean;
  /** called once per vector store query, used for usage metering */
  onQuery?: () => void;
};

const getContext = (experimental_context: unknown): AgenticToolContext => {
  const context = experimental_context as AgenticToolContext | undefined;
  if (!context?.vectorStores?.length) {
    throw new Error("Agentic search tools are missing their tool context");
  }
  return context;
};

const searchInputSchema = z.object({
  query: z.string().describe("The query to search for."),
  mode: z
    .enum(["semantic", "keyword"])
    .describe(
      "semantic: embedding similarity search, best for concepts and paraphrases. keyword: full-text search, best for exact terms, names, and identifiers. Keyword search is not available on every knowledge base; when unavailable, the search runs in semantic mode instead.",
    ),
  label: z
    .string()
    .describe(
      "A concise, human-readable description of what this search is looking for, in the user's language. Shown in the UI only; does NOT affect retrieval.",
    ),
  scope: z
    .object({
      book: z
        .string()
        .optional()
        .describe("Title of a single work, as the user wrote it."),
      author: z
        .string()
        .optional()
        .describe("An author's name, as the user wrote it."),
    })
    .optional()
    .describe(
      'Restricts the search to one work or one author\'s works. Use this — NOT the query text — whenever the question names a source ("من كتاب لسان العرب", "من مؤلفات ابن القيم"). A title placed in `query` searches for passages that MENTION the work, not passages FROM it. Give the name alone and keep `query` to the topic.',
    ),
});

/**
 * What a search returns.
 *
 * A plain array when nothing was scoped, so existing behaviour is byte-for-byte
 * unchanged. A scoped search returns the resolution alongside the chunks so the
 * model can name what it searched; the refusals carry a message rather than an
 * empty list, because an empty list reads as "nothing found" when the truth is
 * "the restriction could not be applied".
 */
type SearchToolOutput =
  | FormattedChunk[]
  | { readonly scope: string; readonly chunks: FormattedChunk[] }
  | { readonly unsupported: true; readonly message: string }
  | { readonly unresolved: true; readonly message: string }
  | {
      readonly ambiguous: true;
      readonly requested: string;
      readonly candidates: string[];
      readonly message: string;
    };

const searchKnowledgeBase = tool<
  z.infer<typeof searchInputSchema>,
  SearchToolOutput
>({
  description: "A tool for searching the knowledge base.",
  inputSchema: searchInputSchema,
  execute: async ({ query, mode, scope }, { experimental_context }) => {
    const context = getContext(experimental_context);

    /*
     * A named source becomes a filter, never part of the query.
     *
     * Resolution is returned to the model rather than applied silently: a title
     * or a kunya routinely matches more than one work or person, and the model
     * has to be able to say which one it searched — or to ask, when the answer
     * would otherwise be authoritative and wrong.
     */
    let filter: Record<string, unknown> | undefined;
    let resolved: ScopeResult | undefined;
    const requested = scope?.book ?? scope?.author;
    if (requested) {
      if (!context.supportsScope) {
        return {
          unsupported: true,
          message: `This knowledge base has no book or author metadata, so it cannot be restricted to "${requested}". Say so rather than answering as though the restriction had been applied.`,
        } as const;
      }
      resolved = scope?.book
        ? await resolveBookScope(scope.book)
        : await resolveAuthorScope(scope!.author!);

      if (resolved.kind === "unresolved") {
        return {
          unresolved: true,
          message: `No work or author matching "${requested}" is in this corpus. Do not answer from elsewhere as though it were.`,
        } as const;
      }
      if (resolved.kind === "ambiguous") {
        return {
          ambiguous: true,
          requested: resolved.requested,
          candidates: resolved.candidates.map((c) => c.label),
          message: `"${requested}" matches more than one. Ask which is meant, naming these, before answering.`,
        } as const;
      }
      filter = { bookId: { $in: resolved.bookIds } };
    }

    // some vector stores (e.g. Pinecone) don't support keyword search, and a
    // keyword search is only meaningful if every corpus can serve one
    const finalMode = context.vectorStores.every((s) => s.supportsKeyword())
      ? mode
      : "semantic";

    const results = await queryStores({
      onTimings: (t) =>
        context.metrics?.recordSearch({
          embedMs: t.embedMs,
          embedTokens: t.embedTokens,
          retrievalMs: t.searchMs + t.rerankMs,
          reranked: t.rerankMs > 0,
        }),
      query,
      mode: finalMode,
      ...(filter ? { filter: filter as never } : {}),
      stores: context.vectorStores,
      embeddingModel: context.embeddingModel,
      topK:
        finalMode === "semantic"
          ? context.search.topK
          : context.search.keywordTopK,
      rerank: finalMode === "semantic" ? context.search.rerank : false,
    });

    context.onQuery?.();
    const chunks = results.map(formatChunk);
    // the resolution rides along so the model can name what it searched, and
    // the pane can show it
    return resolved && "label" in resolved
      ? ({ scope: resolved.label, chunks } as const)
      : chunks;
  },
  toModelOutput: (output) => ({
    type: "json",
    value: Array.isArray(output)
      ? output.map(formatChunkForModel)
      : "chunks" in output
        ? {
            scope: output.scope,
            results: output.chunks.map(formatChunkForModel),
          }
        : output,
  }),
});

const expandInputSchema = z.object({
  documentId: z
    .string()
    .describe(
      "The documentId of the chunk to expand, exactly as returned by search.",
    ),
  sequence_number: z
    .number()
    .describe(
      "The sequence_number of the chunk to expand, exactly as returned by search.",
    ),
});

const expandChunkTool = tool<
  z.infer<typeof expandInputSchema>,
  FormattedChunk[]
>({
  description:
    "A tool for expanding a chunk of text by getting the chunks around it in the same document.",
  inputSchema: expandInputSchema,
  execute: async (
    { documentId, sequence_number },
    { experimental_context },
  ) => {
    const context = getContext(experimental_context);

    // gets 10 chunks around the given chunk, 5 before and 5 after.
    // The model only gets the documentId, not which corpus it came from, so ask
    // every corpus; the ones that don't hold the document return nothing.
    const expandStart = Date.now();
    const perStore = await Promise.all(
      context.vectorStores.map((vectorStore) =>
        expandChunk({
          vectorStore,
          documentId,
          sequenceNumber: sequence_number,
          limit: 10,
        }),
      ),
    );
    const results = perStore.flat();
    context.metrics?.recordExpand(Date.now() - expandStart);

    context.onQuery?.();
    return results.map(formatChunk);
  },
  toModelOutput: (output) => ({
    type: "json",
    value: output.map(formatChunkForModel),
  }),
});

export const agenticTools = {
  search: searchKnowledgeBase,
  expand: expandChunkTool,
} satisfies ToolSet;

export type AgenticTools = typeof agenticTools;
