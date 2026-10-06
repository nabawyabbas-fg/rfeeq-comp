import type { FormattedChunk } from "@/lib/agentic-search/format-chunk";

import { fetchSource, query } from "./client";

/**
 * موسوعة المصطلحات الإسلامية — `terminologyenc.com`.
 *
 * The brief's rule for this domain is a ranking, not a permission:
 * **يقدم على الترجمة التلقائية في المصطلحات الشرعية الحساسة** — the approved
 * equivalent beats a fluent translation. `terminology.md` makes the stakes
 * concrete: every ضابط it lists is a *negative* constraint, naming the
 * reduction a plausible translation would collapse the term into — «الشريعة»
 * into penal law, «الفتوى» into ordinary information, «التوحيد» into mere
 * numerical oneness.
 *
 * So a sensitive term needs a **lookup**, not a translation, and this is the
 * lookup. Asking for the same term id in another language returns that
 * language's approved equivalent *and* its definition, rather than a rendering
 * of the Arabic.
 */

const BASE = "https://terminologyenc.com/api/v1";

export interface TermCategory {
  id: string;
  title: string;
  parent_id: string | null;
}

interface TermSummary {
  id: string;
  term: string;
  translations: string[];
}

interface TermDetail {
  id: string | null;
  term: string | null;
  /** The technical definition — التعريف الاصطلاحي. */
  idio_def?: string;
  /** A fuller explanation. */
  brief_expl?: string;
  /** The lexical sense — التعريف اللغوي. */
  ling_def?: string;
  brief_ling_def?: string;
  /** Where the term is used across the disciplines. */
  value?: string;
  root?: string;
  categories?: string[];
  translations?: string[];
}

const toChunk = (term: TermDetail, language: string): FormattedChunk | null => {
  if (!term.id || !term.term) return null;

  const documentId = `terminologyenc-${term.id}`;

  /*
   * The definition is the citable text, not the headword. A term on its own is
   * the thing being asked about; what makes it evidence is the approved
   * definition attached to it.
   */
  const text = [term.idio_def, term.brief_expl].filter(Boolean).join("\n\n");

  return {
    id: `${documentId}#${language}`,
    documentId,
    text: text || term.term,
    metadata: {
      source: "terminologyenc",
      title: term.term,
      language,
      technicalDefinition: term.idio_def,
      linguisticDefinition: term.ling_def ?? term.brief_ling_def,
      usage: term.value,
      root: term.root,
      availableLanguages: term.translations,
      sourceUrl: `https://terminologyenc.com/ar/browse/term/${term.id}`,
    },
  };
};

export const getCategories = async (language = "ar") =>
  fetchSource<TermCategory[]>(`${BASE}/categories/list?${query({ language })}`);

export const listByCategory = async (
  categoryId: string,
  { language = "ar", page = 1, perPage = 15 } = {},
) => {
  const data = await fetchSource<{ data?: TermSummary[] }>(
    `${BASE}/terms/list/?${query({
      language,
      category_id: categoryId,
      page,
      per_page: perPage,
    })}`,
  );
  return data.data ?? [];
};

/**
 * One term, in one language.
 *
 * `language` selects the edition, so asking for `en` returns the approved
 * English equivalent and an English definition — which is the whole point of
 * preferring this over translating the Arabic at answer time.
 */
export const getTerm = async (id: string, language = "ar") => {
  const term = await fetchSource<TermDetail>(
    `${BASE}/terms/one/?${query({ language, id })}`,
  );
  return toChunk(term, language);
};
