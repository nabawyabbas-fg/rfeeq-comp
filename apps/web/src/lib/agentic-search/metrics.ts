import {
  priceEmbedding,
  priceLLM,
  RERANK_PRICE_PER_CALL,
} from "@agentset/validation";

/**
 * Per-answer cost and latency, broken down by pipeline stage.
 *
 * The agentic loop interleaves tool-calling and writing in one streamText call,
 * so "extraction" and "generation" are separated by step: every step that ends
 * in a tool call was the model deciding what to search, and the final step is
 * the answer. That is the only honest split available — the SDK reports usage
 * per step, not per token role.
 */
export interface StageMetrics {
  ms: number;
  tokens?: { input: number; output: number };
  /** null when the model's price is not configured — shown as "—", never 0. */
  usd: number | null;
  calls?: number;
}

export interface AnswerMetrics {
  model: string;
  embeddingModel: string;
  /** may differ from `model` when a separate model chooses the searches */
  extractionModel: string;
  extraction: StageMetrics;
  embedding: StageMetrics;
  retrieval: StageMetrics;
  generation: StageMetrics;
  totalMs: number;
  /** null if any priced stage is unknown, so a partial total is never shown. */
  totalUsd: number | null;
}

export class MetricsCollector {
  private readonly started = Date.now();

  private embedMs = 0;
  private embedTokens = 0;
  private embedCalls = 0;

  private retrievalMs = 0;
  private retrievalCalls = 0;
  private rerankCalls = 0;

  private stepIn = 0;
  private stepOut = 0;
  private finalIn = 0;
  private finalOut = 0;
  private stepCount = 0;
  private stepMs = 0;
  private finalMs = 0;

  constructor(
    private readonly model: string,
    private readonly embeddingModel: string,
    /**
     * Model that ran the search-choosing step, when it differs. Without this
     * the extraction tokens are priced at the generation model's rate, which
     * understated a split run's cost by roughly 40%.
     */
    private readonly extractionModel: string = model,
  ) {}

  /** One search: query embedding, vector search, optional rerank. */
  recordSearch(opts: {
    embedMs: number;
    embedTokens: number;
    retrievalMs: number;
    reranked: boolean;
  }) {
    this.embedMs += opts.embedMs;
    this.embedTokens += opts.embedTokens;
    this.embedCalls += 1;
    this.retrievalMs += opts.retrievalMs;
    this.retrievalCalls += 1;
    if (opts.reranked) this.rerankCalls += 1;
  }

  /** An expand call — retrieval only, no embedding. */
  recordExpand(ms: number) {
    this.retrievalMs += ms;
    this.retrievalCalls += 1;
  }

  /**
   * Usage and wall time for one step of the loop. Steps accumulate into
   * "extraction"; the most recent one is held back as the candidate final step
   * and folded in when another arrives, since only at the end is it known which
   * step actually produced the answer. Durations are carried the same way, so
   * both stages report measured time rather than an apportioned estimate.
   */
  recordStep(
    usage: { inputTokens?: number; outputTokens?: number },
    ms: number,
  ) {
    // fold the previously-final step back into extraction
    this.stepCount += 1;
    this.stepIn += this.finalIn;
    this.stepOut += this.finalOut;
    this.stepMs += this.finalMs;
    this.finalIn = usage.inputTokens ?? 0;
    this.finalOut = usage.outputTokens ?? 0;
    this.finalMs = ms;
  }

  finish(): AnswerMetrics {
    const totalMs = Date.now() - this.started;

    const extractionUsd = priceLLM(
      this.extractionModel,
      this.stepIn,
      this.stepOut,
    );
    const generationUsd = priceLLM(this.model, this.finalIn, this.finalOut);
    const embedUsd = priceEmbedding(this.embeddingModel, this.embedTokens);
    const rerankUsd = this.rerankCalls * RERANK_PRICE_PER_CALL;

    const anyUnknown =
      extractionUsd === null || generationUsd === null || embedUsd === null;

    return {
      model: this.model,
      embeddingModel: this.embeddingModel,
      extractionModel: this.extractionModel,
      extraction: {
        ms: this.stepMs,
        tokens: { input: this.stepIn, output: this.stepOut },
        usd: extractionUsd,
        // every step but the last ended in a tool call
        calls: Math.max(0, this.stepCount - 1),
      },
      embedding: {
        ms: this.embedMs,
        tokens: { input: this.embedTokens, output: 0 },
        usd: embedUsd,
        calls: this.embedCalls,
      },
      retrieval: {
        ms: this.retrievalMs,
        usd: rerankUsd,
        calls: this.retrievalCalls,
      },
      generation: {
        ms: this.finalMs,
        tokens: { input: this.finalIn, output: this.finalOut },
        usd: generationUsd,
      },
      totalMs,
      totalUsd: anyUnknown
        ? null
        : (extractionUsd ?? 0) +
          (generationUsd ?? 0) +
          (embedUsd ?? 0) +
          rerankUsd,
    };
  }
}
