import { callMcpTool } from "./client";

/**
 * Full-text search across the approved encyclopedias.
 *
 * One query reaches موسوعة الأحاديث النبوية and موسوعة المحتوى الإسلامي
 * باللغات together, in Arabic or in any of the languages they publish. This is
 * what the MCP route buys over the REST APIs: those are catalogues to be
 * browsed by category and fetched by id, so an agent had to guess which chapter
 * a hadith might sit in. Here it asks a question.
 *
 * The Qurʾān corpus is listed by the server but returns nothing for any query,
 * in Arabic or English — measured, not assumed. Qurʾānic search therefore goes
 * through `quran.ts`, which uses the concordance at مركز تفسير instead.
 *
 * Results are candidates, not evidence. A hit carries an id, a title and a
 * link; it does not carry the grading, which is the one field the brief
 * requires before a hadith may be cited. Only `fetchDocuments` turns a
 * candidate into something citable, and it refuses the ones that arrive
 * ungraded.
 */

export type Corpus = "hadith" | "library";

export interface SearchHit {
  /** Opaque id — pass to `fetchDocuments`, never construct one. */
  id: string;
  title: string;
  url: string;
}

export const searchEncyclopedias = async (
  query: string,
  { corpora, language = "ar", limit = 10 }: {
    corpora?: Corpus[];
    language?: string;
    limit?: number;
  } = {},
): Promise<SearchHit[]> => {
  const { structuredContent } = await callMcpTool("islamic-content", "search", {
    query,
    ...(corpora && { sources: corpora }),
    language,
    limit: Math.min(Math.max(limit, 1), 25),
  });

  const results = (structuredContent as { results?: unknown } | undefined)
    ?.results;
  if (!Array.isArray(results)) return [];

  return results.flatMap((raw) => {
    const hit = raw as Partial<SearchHit>;
    return hit.id && hit.title && hit.url
      ? [{ id: hit.id, title: hit.title, url: hit.url }]
      : [];
  });
};
