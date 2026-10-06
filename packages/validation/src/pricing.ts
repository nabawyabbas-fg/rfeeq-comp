/**
 * USD per million tokens, used to attribute the cost of a single answer.
 *
 * Rates taken from the vendors' own pricing pages (August 2026):
 *   OpenAI  https://developers.openai.com/api/docs/pricing
 *   Google  https://ai.google.dev/gemini-api/docs/pricing
 *   Kimi    OpenRouter /models, which is the billing path we actually use
 *
 * Anything absent renders as "—" rather than a plausible-looking guess: a wrong
 * cost figure gets trusted and budgeted against, which is worse than no figure.
 */
export interface TokenPrice {
  /** USD per 1M input tokens. */
  input: number;
  /** USD per 1M output tokens. */
  output: number;
  /**
   * Several models charge more once a prompt crosses a size threshold. This
   * matters here: agentic search feeds ~50 chunks per search across several
   * searches, so a long answer can genuinely cross 200k input tokens.
   */
  longContext?: { overTokens: number; input: number; output: number };
}

export const LLM_PRICING: Record<string, TokenPrice> = {
  // OpenAI (direct / Azure deployments use the same model ids here)
  "openai:gpt-5.5": { input: 5.0, output: 30.0 },
  "openai:gpt-5.2": { input: 1.75, output: 14.0 },
  "openai:gpt-5.1": { input: 1.25, output: 10.0 },
  "openai:gpt-5": { input: 1.25, output: 10.0 },
  "openai:gpt-5-mini": { input: 0.25, output: 2.0 },
  "openai:gpt-5-nano": { input: 0.05, output: 0.4 },
  "openai:gpt-4.1": { input: 2.0, output: 8.0 },

  // Google
  "google:gemini-3.1-pro-preview": {
    input: 2.0,
    output: 12.0,
    longContext: { overTokens: 200_000, input: 4.0, output: 18.0 },
  },
  // promotional rate; rises to $1.50/$7.50 on 2027-01-01
  "google:gemini-3.7-flash": { input: 0.75, output: 3.75 },
  "google:gemini-3.5-flash": { input: 1.5, output: 9.0 },
  "google:gemini-3.1-flash-lite-preview": { input: 0.25, output: 1.5 },
  // ai.google.dev/gemini-api/docs/pricing — paid tier, text input
  "google:gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
  "google:gemini-2.5-pro": {
    input: 1.25,
    output: 10.0,
    longContext: { overTokens: 200_000, input: 2.5, output: 15.0 },
  },

  // Moonshot via OpenRouter — that is the path we bill through
  "openrouter:moonshotai/kimi-k3": { input: 3.0, output: 15.0 },
  "openrouter:moonshotai/kimi-k2-thinking": { input: 0.6, output: 2.5 },
  "openrouter:moonshotai/kimi-k2.6": { input: 0.95, output: 4.0 },
};

/** USD per 1M tokens for embedding models. Confirmed against actual spend. */
export const EMBEDDING_PRICING: Record<string, number> = {
  "text-embedding-3-large": 0.13,
  "text-embedding-3-small": 0.02,
};

/** USD per rerank call (Cohere bills one search unit per call here). */
export const RERANK_PRICE_PER_CALL = 0.002;

export const priceLLM = (
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | null => {
  const p = LLM_PRICING[model];
  if (!p) return null;

  const tier =
    p.longContext && inputTokens > p.longContext.overTokens
      ? p.longContext
      : p;

  return (inputTokens / 1e6) * tier.input + (outputTokens / 1e6) * tier.output;
};

export const priceEmbedding = (
  model: string,
  tokens: number,
): number | null => {
  const rate = EMBEDDING_PRICING[model];
  if (rate === undefined) return null;
  return (tokens / 1e6) * rate;
};
