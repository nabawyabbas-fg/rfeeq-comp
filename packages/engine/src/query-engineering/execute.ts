import type { EmbeddingModel } from "ai";

import type { VectorStore } from "../vector-store/common/vector-store";
import { queryVectorStore } from "../vector-store/query";
import type { PlannedSearch, SearchPlan } from "./index";

export interface PlannedResult {
  id: string;
  text: string;
  metadata?: Record<string, unknown>;
  /** Best raw score this chunk achieved in any single search. */
  score?: number;
  /** Fused rank score across the plan's searches. */
  fusedScore: number;
  /** Which planned searches surfaced this chunk. */
  facets: string[];
}

/**
 * Runs every search in a plan and fuses the rankings.
 *
 * Fusion is reciprocal rank rather than raw score because the searches are not
 * comparable: BM25 scores are unbounded while cosine sits in [0,1], and a
 * `prohibiting` search legitimately returns lower absolute scores than a `core`
 * search without being less important. Straight score-sorting would let one
 * facet crowd out the others, which is the exact failure that makes a disputed
 * ruling read as settled.
 */
/**
 * Plain RRF rewards breadth: a chunk appearing in four peripheral searches
 * outranks one that dominates the central question. That is usually right when
 * assembling context, but it can bury the single best passage. Weighting the
 * facets keeps the core question ahead without losing the opposing views.
 */
export const DEFAULT_FACET_WEIGHTS: Record<string, number> = {
  core: 1.6,
  evidence: 1.1,
  permitting: 1.0,
  prohibiting: 1.0,
  conditions: 0.9,
  definition: 0.9,
};

export const executePlan = async ({
  plan,
  embeddingModel,
  vectorStore,
  topK = 10,
  perSearchTopK = 10,
  rrfK = 60,
  facetWeights = DEFAULT_FACET_WEIGHTS,
}: {
  plan: SearchPlan;
  embeddingModel: EmbeddingModel;
  vectorStore: VectorStore;
  topK?: number;
  perSearchTopK?: number;
  rrfK?: number;
  facetWeights?: Record<string, number>;
}): Promise<{ results: PlannedResult[]; perSearch: Map<string, number> }> => {
  const runs = await Promise.all(
    plan.searches.map(async (search: PlannedSearch) => {
      // A store without keyword support silently degrades to semantic, which is
      // better than failing the whole plan.
      const mode =
        (search.mode === "keyword" || search.mode === "hybrid") &&
        !vectorStore.supportsKeyword()
          ? "semantic"
          : search.mode;

      const { results } = await queryVectorStore({
        query: search.query,
        embeddingModel,
        vectorStore,
        topK: perSearchTopK,
        mode,
        includeMetadata: true,
        rerank: false,
      });

      return { search, results };
    }),
  );

  const merged = new Map<string, PlannedResult>();
  const perSearch = new Map<string, number>();

  for (const { search, results } of runs) {
    perSearch.set(search.query, results.length);

    results.forEach((result, rank) => {
      const weight = facetWeights[search.facet] ?? 1;
      const contribution = weight / (rrfK + rank + 1);
      const existing = merged.get(result.id);

      if (existing) {
        existing.fusedScore += contribution;
        if (!existing.facets.includes(search.facet)) {
          existing.facets.push(search.facet);
        }
        if ((result.score ?? 0) > (existing.score ?? 0)) {
          existing.score = result.score;
        }
        return;
      }

      merged.set(result.id, {
        id: result.id,
        text: result.text,
        metadata: result.metadata,
        score: result.score,
        fusedScore: contribution,
        facets: [search.facet],
      });
    });
  }

  const results = [...merged.values()]
    .sort((a, b) => b.fusedScore - a.fusedScore)
    .slice(0, topK);

  return { results, perSearch };
};
