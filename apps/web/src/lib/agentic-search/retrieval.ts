import type {
  QueryTimings,
  QueryVectorStoreOptions,
  VectorStore,
  VectorStoreResult,
} from "@agentset/engine";
import { getRerankingModel, queryVectorStore, rerank } from "@agentset/engine";

/**
 * Runs one search across one or more collections.
 *
 * Corpora live in separate Qdrant collections, so searching more than one means
 * querying each and combining. The combining is the part that needs care:
 * hybrid search fuses dense and sparse hits by reciprocal rank, so a result's
 * score means "how highly this ranked *within its own collection*". Sorting two
 * such lists together would let the best hit from a small collection outrank a
 * better hit from a large one purely because it faced less competition.
 *
 * So the collections are pooled *before* reranking, and the reranker scores the
 * whole pool in one pass. Those scores are comparable, because they come from
 * one model judging every candidate against the same question.
 *
 * With reranking off there is no comparable score to be had, so the lists are
 * interleaved round-robin instead — equal representation rather than pretending
 * the numbers mean the same thing.
 */
type QueryStoresOptions = Omit<
  QueryVectorStoreOptions,
  "vectorStore" | "includeMetadata"
> & {
  stores: VectorStore[];
};

export const queryStores = async ({
  stores,
  rerank: rerankOptions,
  onTimings,
  ...rest
}: QueryStoresOptions): Promise<VectorStoreResult[]> => {
  const topK = rest.topK ?? 10;

  if (stores.length === 1) {
    // single collection: unchanged behaviour, reranked by queryVectorStore
    const result = await queryVectorStore({
      ...rest,
      onTimings,
      vectorStore: stores[0]!,
      rerank: rerankOptions,
      includeMetadata: true,
    });
    return result.results;
  }

  // Fetch candidates from each collection without reranking, so the reranker
  // sees them all together rather than scoring each list in isolation.
  const timings: QueryTimings = {
    embedMs: 0,
    searchMs: 0,
    rerankMs: 0,
    embedTokens: 0,
  };

  const perStore = await Promise.all(
    stores.map(async (vectorStore) => {
      const result = await queryVectorStore({
        ...rest,
        vectorStore,
        rerank: false,
        includeMetadata: true,
        onTimings: (t) => {
          // the query is embedded once per collection, so tokens add up, but
          // the calls run concurrently, so wall-clock is the slowest of them
          timings.embedTokens += t.embedTokens;
          timings.embedMs = Math.max(timings.embedMs, t.embedMs);
          timings.searchMs = Math.max(timings.searchMs, t.searchMs);
        },
      });
      return result.results;
    }),
  );

  const pooled = perStore.flat();
  if (!rerankOptions || pooled.length === 0) {
    onTimings?.(timings);
    return rerankOptions ? pooled : interleave(perStore).slice(0, topK);
  }

  const rerankStart = Date.now();
  const reranker = await getRerankingModel(rerankOptions.model);
  const ranked = await rerank(pooled, {
    model: reranker,
    limit: rerankOptions.limit ?? topK,
    query: rest.query,
  });
  timings.rerankMs = Date.now() - rerankStart;
  onTimings?.(timings);
  return ranked;
};

/** Round-robin, so neither collection is buried when scores aren't comparable. */
const interleave = <T>(lists: T[][]): T[] => {
  const out: T[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) {
    for (const list of lists) if (list[i] !== undefined) out.push(list[i]!);
  }
  return out;
};
