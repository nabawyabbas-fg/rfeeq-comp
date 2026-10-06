import type { FormattedChunk } from "@/lib/agentic-search/format-chunk";

import { callMcpTool } from "./client";
import { fetchDocuments } from "./documents";

/**
 * The Qurʾānic text, and the way to find a place in it.
 *
 * Two approved servers, each doing the one thing it does well — a split that
 * was measured rather than guessed:
 *
 * **موسوعة القرآن الكريم supplies the text.** It returns the ʿUthmānī
 * orthography with full diacritics, `ٱدۡعُ إِلَىٰ سَبِيلِ رَبِّكَ`, which is what makes
 * it canonical. The brief's rule for this domain is one line — «أهمية التأكد من
 * موثوقية نقل الآيات» — and a verse is read from here or not reproduced at all.
 *
 * **مركز تفسير supplies the concordance.** Its index is diacritic-insensitive,
 * so a reader who types «الصابرين» without vowels finds the verse; the
 * encyclopedia's own Qurʾān search returns nothing for any query. But its verse
 * text comes back *undiacriticised* — `ادع إلى سبيل ربك` — so it is used to
 * locate a verse and never to quote one.
 *
 * `searchVerses` composes the two: find the reference at one source, fetch the
 * canonical wording from the other. The model sees a single search that returns
 * properly pointed verses, which is the only behaviour that is both findable
 * and faithful.
 */

/** A verse reference, before its canonical text has been fetched. */
interface VerseRef {
  surah: number;
  ayah: number;
}

/**
 * How many verses one call may return.
 *
 * Ranges matter: a verse quoted alone is routinely a verse read out of context,
 * and the commentary tradition reads in passages. Capped so a careless call
 * cannot pull a whole sūra into the context window.
 */
const MAX_VERSES = 20;

const idFor = (surah: number, ayah: number, language: string) =>
  `quran:${surah}:${ayah}:${language}`;

/**
 * One verse, or a short range from one sūra.
 *
 * Fetched per verse and in parallel rather than as a block, because the
 * per-verse document is the structured one: it separates the ʿUthmānī text from
 * the approved translation as distinct segments, which is what keeps a
 * translation from being quoted as the verse.
 */
export const getVerses = async (
  surah: number,
  fromAyah: number,
  throughAyah = fromAyah,
  language = "ar",
): Promise<FormattedChunk[]> => {
  const first = Math.min(fromAyah, throughAyah);
  const last = Math.min(Math.max(fromAyah, throughAyah), first + MAX_VERSES - 1);

  const ids = Array.from({ length: last - first + 1 }, (_, offset) =>
    idFor(surah, first + offset, language),
  );

  /*
   * The sūra's name is fetched alongside the verses, not after them.
   *
   * The verse document carries its sūra *number* and not its name, and the
   * reference row the templates render wants the name — «سورة النحل · الآية
   * ١٢٥» rather than «سورة رقم ١٦». Naming it from memory is what the prompt
   * forbids for scripture, so it is looked up from an approved source and
   * travels on the chunk. One extra call per verse fetch, concurrent with the
   * verses themselves, and a failed lookup leaves the number standing rather
   * than a guess taking its place.
   */
  const [chunks, info] = await Promise.all([
    fetchDocuments(ids),
    getSurahInfo(surah).catch(() => null),
  ]);

  // the muṣḥaf order is the reading order, so the āya number is the position
  return chunks.map((chunk) => ({
    ...chunk,
    sequence_number: Number(chunk.metadata?.aya ?? 0) || undefined,
    metadata: {
      ...chunk.metadata,
      ...(info?.name && { surahName: info.name }),
    },
  }));
};

/**
 * Finds verses by their wording, then returns them in the canonical text.
 *
 * The query is matched without diacritics, so it works on what a reader
 * actually types. What comes back is the pointed verse from موسوعة القرآن, not
 * the stripped text the index matched against.
 */
export const searchVerses = async (
  query: string,
  { limit = 5, language = "ar" } = {},
): Promise<FormattedChunk[]> => {
  const { structuredContent, texts } = await callMcpTool(
    "tafsir-center",
    "search_quran_text",
    { query, limit: Math.min(Math.max(limit, 1), MAX_VERSES) },
  );

  /*
   * The structured payload holds the whole result set; the text channel holds
   * one hit per part. The former is read when present because reading the
   * latter as a single document would silently reduce every search to its
   * first hit — or to nothing, if parsed as the array it is not.
   */
  const fromStructured = (structuredContent as { result?: unknown } | undefined)
    ?.result;
  const refs: VerseRef[] = Array.isArray(fromStructured)
    ? (fromStructured as VerseRef[])
    : texts.flatMap((part) => {
        try {
          return [JSON.parse(part) as VerseRef];
        } catch {
          return [];
        }
      });

  const ids = refs
    .filter((ref) => Number.isInteger(ref.surah) && Number.isInteger(ref.ayah))
    .slice(0, MAX_VERSES)
    .map((ref) => idFor(ref.surah, ref.ayah, language));

  const chunks = await fetchDocuments(ids);

  /*
   * Named per sūra, one lookup each rather than one per verse: a search
   * typically lands in a handful of sūras, and the reference row wants the name
   * for every hit it shows, not only for the ones that share a sūra with the
   * first.
   */
  const surahs = [
    ...new Set(
      chunks
        .map((chunk) => Number(chunk.metadata?.sura))
        .filter((value) => Number.isInteger(value)),
    ),
  ];
  const names = new Map(
    await Promise.all(
      surahs.map(async (surah) => {
        const info = await getSurahInfo(surah).catch(() => null);
        return [surah, info?.name ?? null] as const;
      }),
    ),
  );

  return chunks.map((chunk) => {
    const name = names.get(Number(chunk.metadata?.sura));
    return name
      ? { ...chunk, metadata: { ...chunk.metadata, surahName: name } }
      : chunk;
  });
};

/**
 * A sūra's own data: its names, where it was revealed, its āya count.
 *
 * Replaces a scrape of `quranpedia.net` that existed only to turn «سورة رقم 16»
 * into «النحل». Naming a sūra from memory is what the prompt forbids for
 * scripture, and this is an approved source that publishes the names — so the
 * name is looked up, and when the lookup fails the number stands rather than a
 * guess taking its place.
 */
export const getSurahInfo = async (surah: number) => {
  const { text } = await callMcpTool("tafsir-center", "fetch_surah_info", {
    surah,
  });
  if (!text) return null;

  try {
    const parsed = JSON.parse(text) as {
      surah_no?: number;
      names?: string[];
      revelation_type?: string;
      ayah_count?: number;
      virtues?: string;
    };
    return {
      surah: parsed.surah_no ?? surah,
      name: parsed.names?.[0] ?? null,
      names: parsed.names ?? [],
      revelationType: parsed.revelation_type ?? null,
      ayahCount: parsed.ayah_count ?? null,
      virtues: parsed.virtues ?? null,
    };
  } catch {
    return null;
  }
};
