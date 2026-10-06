import type { FormattedChunk } from "@/lib/agentic-search/format-chunk";

/**
 * The chunks in a `tool-search` / `tool-expand` output part.
 *
 * The search tool returns a bare array normally, but `{ scope, chunks }` when
 * the question named a book or author, and a message-only object when the
 * scope could not be honoured. Every consumer used to iterate the output
 * directly, so the scoped shape threw `part.output is not iterable` in the UI
 * and silently emptied the quote-verification haystack.
 *
 * Reading the output through here rather than inline keeps the next consumer
 * from having to know that, and the next shape from having to be chased across
 * five files.
 */
export const chunksOfToolOutput = (output: unknown): FormattedChunk[] => {
  if (Array.isArray(output)) return output as FormattedChunk[];
  if (output && typeof output === "object" && "chunks" in output) {
    const chunks = (output as { chunks?: unknown }).chunks;
    if (Array.isArray(chunks)) return chunks as FormattedChunk[];
  }
  // unsupported / unresolved / ambiguous carry no chunks: no retrieval
  // happened, which is not the same as a search that found nothing
  return [];
};

/** The resolved scope label, when the search was restricted to a source. */
export const scopeOfToolOutput = (output: unknown): string | null => {
  if (output && typeof output === "object" && "scope" in output) {
    const scope = (output as { scope?: unknown }).scope;
    if (typeof scope === "string") return scope;
  }
  return null;
};

/**
 * The passages a message part retrieved, if it is a retrieval tool's output.
 *
 * Defined by what the part *returns* rather than by its name. The citation
 * plumbing originally matched `tool-search` and `tool-expand` literally, which
 * made any new retrieval tool invisible to it — its chunks never reached the
 * sources panel, and citations against them resolved to nothing. Adding a
 * source should not require editing the renderer, so the test is now "did this
 * tool hand back chunks".
 *
 * Returns the chunks rather than a boolean so the caller never has to narrow
 * the part union to reach `output`.
 */
export const retrievalChunks = (part: { type: string }): FormattedChunk[] => {
  if (!part.type.startsWith("tool-")) return [];

  const candidate = part as { state?: string; output?: unknown };
  if (candidate.state !== "output-available") return [];

  return chunksOfToolOutput(candidate.output);
};
