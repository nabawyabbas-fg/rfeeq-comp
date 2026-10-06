import { embed, EmbeddingModel } from "ai";

import { RerankingModel } from "@agentset/validation";

import { getRerankingModel, rerank } from "../rerank";
import { VectorStore, VectorStoreQueryOptions } from "./common/vector-store";

/** Per-stage timings, so callers can attribute latency without re-timing. */
export interface QueryTimings {
  embedMs: number;
  searchMs: number;
  rerankMs: number;
  embedTokens: number;
}

export type QueryVectorStoreOptions = Omit<VectorStoreQueryOptions, "mode"> & {
  /** Called once with stage timings after the query completes. */
  onTimings?: (timings: QueryTimings) => void;
  query: string;
  embeddingModel: EmbeddingModel;
  vectorStore: VectorStore;
  rerank?: false | { model?: RerankingModel; limit?: number };
  mode?: VectorStoreQueryOptions["mode"]["type"];
  consistency?: VectorStoreQueryOptions["consistency"];
};

export const queryVectorStore = async ({
  embeddingModel,
  vectorStore,
  mode = "semantic",
  ...options
}: QueryVectorStoreOptions) => {
  const t0 = Date.now();
  const embedding = await embed({
    model: embeddingModel,
    value: options.query,
  });
  const embedMs = Date.now() - t0;

  const t1 = Date.now();
  const results = await vectorStore.query({
    mode: {
      type: mode,
      vector: embedding.embedding,
      text: options.query,
    },
    topK: options.topK,
    filter: options.filter,
    minScore: options.minScore,
    includeMetadata: options.includeMetadata,
    includeRelationships: options.includeRelationships,
    consistency: options.consistency,
  });

  const searchMs = Date.now() - t1;

  // If re-ranking is enabled and we have a query, perform reranking
  const t2 = Date.now();
  let rerankedResults: typeof results | null = null;
  if (options.rerank && results.length > 0) {
    const reranker = await getRerankingModel(options.rerank.model);
    rerankedResults = await rerank(results, {
      model: reranker,
      limit: options.rerank.limit ?? options.topK,
      query: options.query,
    });
  }

  options.onTimings?.({
    embedMs,
    searchMs,
    rerankMs: Date.now() - t2,
    embedTokens: embedding.usage?.tokens ?? 0,
  });

  return {
    query: options.query,
    unorderedIds: rerankedResults ? results.map((result) => result.id) : null,
    results: rerankedResults || results,
  };
};

export type QueryVectorStoreResult = NonNullable<
  Awaited<ReturnType<typeof queryVectorStore>>
>;
