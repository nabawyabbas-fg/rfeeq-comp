import type { FormattedChunk } from "@/lib/agentic-search/format-chunk";
import type { MyUIMessage } from "@/types/ai";
import { retrievalChunks } from "@/lib/tool-output";

/**
 * Resolves the chunk ids in one `<citation ids="…" />` tag to the passages
 * they name.
 *
 * Extracted from the citation pill so the Rfeeq answer frame can number
 * citations off exactly the resolution the pill uses. Duplicating it was the
 * alternative, and the tolerance below is the kind of code that must not exist
 * twice: it encodes measurements taken from stored conversations, and two
 * copies would drift the moment either was corrected.
 *
 * Ids are matched against the search and expand outputs of the *whole*
 * conversation, not just this turn — a follow-up legitimately cites a passage
 * retrieved earlier.
 */
export const resolveCitationChunks = (
  ids: string | undefined,
  messages: MyUIMessage[],
): FormattedChunk[] => {
  if (!ids) return [];

  const chunkMap = new Map<string, FormattedChunk>();
  for (const message of messages) {
    for (const part of message.parts) {
      // any retrieval tool's output, so a new source becomes citable without
      // this resolver having to learn its name
      for (const chunk of retrievalChunks(part)) {
        chunkMap.set(chunk.id, chunk);
      }
    }
  }

  /**
   * Resolves one emitted id, tolerating a specific mistake models make.
   *
   * A chunk id is `${documentId}#${chunkId}`, and for this corpus the chunkId
   * itself begins with the book id — `turath-10517#10517:858`. That repetition
   * invites models to drop the duplicate and emit `turath-10517#858`. Across
   * the stored conversations 58 of 59 unresolvable citations were exactly this,
   * and none were invented.
   *
   * The suffix match is only accepted when it identifies a single chunk. An
   * ambiguous or absent match stays unresolved: showing the wrong passage under
   * a confident-looking citation is worse than admitting the link is broken.
   */
  const resolve = (id: string): FormattedChunk | undefined => {
    const exact = chunkMap.get(id);
    if (exact) return exact;

    const hash = id.indexOf("#");
    if (hash === -1) {
      /*
       * No "#" at all. Two things the model does instead of quoting the
       * chunk id, both of which name a real retrieved passage:
       *
       *   turath-27107        — the document alone
       *   turath-27107:47444  — the document and the chunk's suffix, with
       *                         the repeated "#<bookId>" left out
       *
       * Together these were 11.5% of every citation emitted, all of them
       * rendering as "Unknown citation" over a passage that was retrieved
       * and read. The document is what the pill names and opens, so
       * resolving to one of its chunks is both correct and sufficient.
       */
      const colon = id.lastIndexOf(":");
      if (colon > 0) {
        const doc = id.slice(0, colon);
        const suf = id.slice(colon + 1);
        const hits: FormattedChunk[] = [];
        for (const chunk of chunkMap.values()) {
          if (chunk.documentId === doc && chunk.id.endsWith(`:${suf}`)) {
            hits.push(chunk);
            if (hits.length > 1) break; // ambiguous
          }
        }
        if (hits.length === 1) return hits[0];
      }
      for (const chunk of chunkMap.values()) {
        if (chunk.documentId === id) return chunk;
      }
      return undefined;
    }
    const documentId = id.slice(0, hash);
    const suffix = id.slice(hash + 1);
    if (!suffix) return undefined;

    const matches: FormattedChunk[] = [];
    for (const chunk of chunkMap.values()) {
      if (!chunk.id.startsWith(`${documentId}#`)) continue;
      if (chunk.id.endsWith(`:${suffix}`)) matches.push(chunk);
      if (matches.length > 1) return undefined; // ambiguous
    }
    return matches[0];
  };

  const seen = new Set<string>();
  const result: FormattedChunk[] = [];
  for (const rawId of ids.split(",")) {
    const id = rawId.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const chunk = resolve(id);
    if (chunk) result.push(chunk);
  }
  return result;
};
