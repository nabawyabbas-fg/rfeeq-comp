import type { FormattedChunk } from "@/lib/agentic-search/format-chunk";

import { callMcpTool } from "./client";
import { rootFromSarf } from "./sciences";

/**
 * A word's life in the Qurʾān: its root, how often it occurs, and in which
 * forms.
 *
 * The specification's §6 additions, which it states as a sentence and a table:
 *
 *   «التقوى في الاستعمال القرآني — ورد الجذر (…) في القرآن (…) مرة.»
 *   «الصيغة | عدد المرات | المثال»
 *
 * None of it can be answered from the word alone. The concordance is keyed on
 * the **root**, and no tool maps a word to its root directly — `analyze_word`
 * does, but only for a word at a known position in a known āya. So the root is
 * reached by a chain, and the chain is the reason this lives in its own module:
 *
 *   1. find the word somewhere in the Qurʾān (`search_quran_text`)
 *   2. work out which word of that āya matched, from the marked snippet
 *   3. analyse that word (`analyze_word`) and read its stated مادة
 *   4. ask the concordance about the root (`get_root_stats`,
 *      `find_root_occurrences`)
 *
 * Four calls to answer «ما معنى التقوى؟» properly. The alternative was to let
 * the model supply the root from its own knowledge, which is precisely what
 * this system does not do with anything a source can be asked for.
 */

const str = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const int = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const payload = async <T>(
  tool: string,
  args: Record<string, unknown>,
): Promise<T | null> => {
  const { structuredContent, text } = await callMcpTool(
    "tafsir-center",
    tool,
    args,
  );
  if (structuredContent) return structuredContent as T;
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

interface Hit {
  surah?: number;
  ayah?: number;
  /** The āya with the matched token wrapped in `<m>…</m>`. */
  snippet?: string;
}

/**
 * The spellings to try, in order.
 *
 * The index is token-exact, so «الصبر» finds nothing while «صبر» finds two —
 * the Qurʾān spells it «بِٱلصَّبۡرِ» and the tokeniser keeps the clitics
 * attached. Stripping the article is therefore not a convenience but the
 * difference between answering and not. Two attempts and no wildcard: a prefix
 * search matches across unrelated roots, and a wrong root here would put a
 * confident count under the wrong word.
 */
const spellings = (word: string) => {
  const bare = word.trim().replace(/^(?:ال|وال|بال|كال|فال)/u, "");
  return bare && bare !== word.trim() ? [word.trim(), bare] : [word.trim()];
};

/**
 * Which word of the āya the index matched, 1-based.
 *
 * Read from the snippet rather than by searching the āya text, because the
 * snippet is the index's own tokenisation with the match already marked — the
 * same tokenisation `analyze_word` numbers against. Counting tokens in a text
 * we tokenised ourselves would be guessing at someone else's word division.
 */
const matchedWordNo = (snippet: string) => {
  const before = snippet.split("<m>")[0] ?? "";
  const words = before.trim().split(/\s+/).filter(Boolean);
  return words.length + 1;
};

export interface QuranForm {
  /** الصيغة — the surface form as the muṣḥaf spells it. */
  form: string;
  /** عدد المرات. */
  count: number | null;
  /** المثال — where it first occurs. */
  example: { surah: number; ayah: number } | null;
}

export interface QuranUsage {
  /** The word as it was asked about. */
  word: string;
  /** The word the centre analysed, which is what the root was read from. */
  analysed: string | null;
  root: string;
  occurrences: number | null;
  surahs: number | null;
  ayahs: number | null;
  distinctForms: number | null;
  /** The forms table, most frequent first. */
  forms: QuranForm[];
}

/** How many occurrences to read before grouping them into forms. */
const SAMPLE = 300;

/** How many rows the table shows. A table of fifty forms is a concordance. */
const MAX_FORMS = 12;

/**
 * Reads a word's Qurʾānic usage, or returns null when it has none.
 *
 * Null is a real answer: «ما معنى الفقه؟» is a fair question about a word the
 * Qurʾān does not use in that form, and the template then simply omits the
 * section rather than reporting a zero.
 */
export const quranUsage = async (word: string): Promise<QuranUsage | null> => {
  let hit: Hit | null = null;
  for (const spelling of spellings(word)) {
    const found = await payload<{ result?: Hit[] }>("search_quran_text", {
      query: spelling,
      limit: 1,
    });
    const first = found?.result?.[0];
    if (first?.surah && first.ayah && first.snippet) {
      hit = first;
      break;
    }
  }
  if (!hit?.surah || !hit.ayah || !hit.snippet) return null;

  const analysis = await payload<{ word?: string; sarf?: string }>(
    "analyze_word",
    {
      surah: hit.surah,
      ayah: hit.ayah,
      word_no: matchedWordNo(hit.snippet),
    },
  );
  const root = rootFromSarf(analysis?.sarf);
  if (!root) return null;

  const [stats, occurrences] = await Promise.all([
    payload<{
      found?: boolean;
      occurrences?: number;
      surahs_count?: number;
      ayahs_count?: number;
      distinct_forms?: number;
    }>("get_root_stats", { root }),
    payload<{
      result?: {
        surah?: number;
        ayah?: number;
        word?: string;
        total_occurrences_in_quran?: number;
      }[];
    }>("find_root_occurrences", { root, limit: SAMPLE }),
  ]);

  if (stats?.found === false) return null;

  /*
   * Grouped by surface form, keeping the first occurrence of each as its
   * example. `total_occurrences_in_quran` is the count for that *form*, which
   * is exactly the table's middle column, so the rows are read rather than
   * tallied — a tally over a sample would undercount whatever the sample cut
   * off.
   */
  const byForm = new Map<string, QuranForm>();
  for (const row of occurrences?.result ?? []) {
    const form = str(row.word);
    if (!form || byForm.has(form)) continue;
    byForm.set(form, {
      form,
      count: int(row.total_occurrences_in_quran),
      example:
        row.surah && row.ayah ? { surah: row.surah, ayah: row.ayah } : null,
    });
  }

  return {
    word: word.trim(),
    analysed: str(analysis?.word),
    root,
    occurrences: int(stats?.occurrences),
    surahs: int(stats?.surahs_count),
    ayahs: int(stats?.ayahs_count),
    distinctForms: int(stats?.distinct_forms),
    forms: [...byForm.values()]
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
      .slice(0, MAX_FORMS),
  };
};

/**
 * The usage as a citable chunk.
 *
 * Shaped like every other retrieval result so the section renderer reaches it
 * the same way it reaches a verse or a grading: the model names the id in
 * `ref`, and the table is built from the data rather than retyped. The counts
 * are the centre's, and a model asked to repeat «ورد الجذر وقي ٢٥٨ مرة» in
 * prose is a model one digit away from being wrong about something checkable.
 */
export const usageChunk = (usage: QuranUsage): FormattedChunk => {
  const documentId = `tafsir-center-root-${usage.root}`;
  const summary =
    `ورد الجذر (${usage.root}) في القرآن ${usage.occurrences ?? 0} مرة` +
    (usage.surahs ? `، في ${usage.surahs} سورة` : "") +
    (usage.ayahs ? ` و${usage.ayahs} آية` : "") +
    (usage.distinctForms ? `، على ${usage.distinctForms} صيغة` : "") +
    ".";

  return {
    id: `${documentId}#0`,
    documentId,
    text: summary,
    metadata: {
      source: "tafsir-center",
      title: `الاستعمال القرآني — ${usage.word}`,
      kind: "quran-usage",
      usage,
    },
  };
};
