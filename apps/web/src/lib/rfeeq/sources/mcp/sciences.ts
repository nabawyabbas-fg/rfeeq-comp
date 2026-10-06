import { ALL_TAFSIR_EDITIONS } from "@/lib/rfeeq/expertise";

import { callMcpTool } from "./client";
import { fetchDocument } from "./documents";

/**
 * علوم القرآن for the side panels.
 *
 * The MVP specification puts these behind a tap rather than in the answer, and
 * is specific about both the contents and the default state:
 *
 *   «عند النقر على الآية أو الكلمة — لوحة جانبية … بهذا الترتيب: أسباب النزول،
 *    التفاسير، إعراب الآية، التصريف، التجويد، القراءات، التصنيف الموضوعي،
 *    إحصاءات الكلمة.»
 *   «ما لم يكن السؤال مباشرًا عن أيٍّ مما سبق، تُعرض هذه العلوم في اللوحة
 *    الجانبية **مطويّة**.»
 *
 * All of it was already reachable and none of it was wired: مركز تفسير's server
 * carries the grammar, the tajwīd, the variant readings, the root concordance
 * and the sūra statistics, and this system was calling seven of its seventeen
 * tools. These are the rest.
 *
 * Everything here is read-only and per-āya, so the calls are issued together
 * and a failure in one does not cost the others — a panel missing its qirāʾāt
 * block is worth far more than a panel that failed to open.
 */

const str = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const int = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** Reads a tool's JSON, from whichever channel it answered on. */
const payload = async <T>(
  server: Parameters<typeof callMcpTool>[0],
  tool: string,
  args: Record<string, unknown>,
): Promise<T | null> => {
  const { structuredContent, text } = await callMcpTool(server, tool, args);
  if (structuredContent) return structuredContent as T;
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

/**
 * Never throws: a block that could not be fetched is simply absent.
 *
 * The panel shows eight sciences and no single one of them is the reason the
 * reader opened it, so one unreachable tool must not empty the panel. What it
 * must not do is *fake* the block, which is why the result is null rather than
 * a placeholder.
 */
const soft = <T>(promise: Promise<T | null>): Promise<T | null> =>
  promise.catch(() => null);

/* ---------- مقدمات السورة ---------- */

export interface SurahSciences {
  surah: number;
  /** أسماء السورة — the first is the one used for display. */
  names: string[];
  revelationType: string | null;
  ayahCount: number | null;
  /** فضائل السورة وخصائصها, in the centre's own words. */
  virtues: string | null;
  /** الإحصاءات (أرقام) — the specification's second block, verbatim fields. */
  stats: {
    revelationOrder: number | null;
    /** نوع السورة من حيث الطول: الطوال، المئون، المثاني، المفصّل. */
    surahClass: string | null;
    wordCount: number | null;
    charCount: number | null;
    longestWord: string | null;
    mostFrequentWord: string | null;
    sujud: string | null;
  } | null;
  /** أسماؤها التوقيفية والاجتهادية, where the centre records them. */
  nameGroups: SurahNames[];
}

/**
 * Every name the sūra is known by, from the statistics' `names_info`.
 *
 * `fetch_surah_info` returns a `names` array holding exactly one entry — for
 * البقرة it is `["البقرة"]` — so the block headed «أسماء السورة» showed a single
 * name for every sūra in the Qurʾān, which is the one thing it exists to list.
 * The rest are in `names_info` on `get_surah_statistics`: a long essay opening
 * with a summary that states them under their two headings.
 *
 * Only that summary is read. It ends where the essay begins — the first line
 * starting with `*` — and each heading's list is one line of names separated by
 * commas. Parsing the essay instead would mean deciding which of its sentences
 * names the sūra and which merely discusses a name, and the summary already
 * states the answer.
 */
const NAME_HEADINGS: [string, string][] = [
  ["توقيفية", "أسماؤها التوقيفية"],
  ["اجتهادية", "أسماؤها الاجتهادية"],
];

export interface SurahNames {
  /** «توقيفية» — attested from the Prophet ﷺ — or «اجتهادية». */
  kind: string;
  names: string[];
}

export const surahNames = (namesInfo: string | undefined): SurahNames[] => {
  if (!namesInfo) return [];
  const summary = namesInfo.split(/\n\s*\*/u)[0] ?? "";

  return NAME_HEADINGS.flatMap(([kind, heading]) => {
    const line = new RegExp(`${heading}\\s*:\\s*\\n?([^\\n]+)`, "u").exec(
      summary,
    );
    const names = (line?.[1] ?? "")
      .split(/[،,]/u)
      .map((name) =>
        name
          .trim()
          .replace(/[.ـ]+$/u, "")
          // the list conjunction, not part of the name
          .replace(/^و(?=[\p{L}])/u, "")
          .trim(),
      )
      .filter(Boolean);
    return names.length > 0 ? [{ kind, names }] : [];
  });
};

export const surahSciences = async (
  surah: number,
): Promise<SurahSciences | null> => {
  const [info, stats] = await Promise.all([
    soft(
      payload<{
        surah_no?: number;
        names?: string[];
        revelation_type?: string;
        ayah_count?: number;
        virtues?: string;
      }>("tafsir-center", "fetch_surah_info", { surah }),
    ),
    soft(
      payload<{
        revelation_order?: number;
        surah_class?: string;
        word_count?: number;
        char_count?: number;
        longest_word?: string;
        most_freq_word?: string;
        sujud?: string;
        names_info?: string;
      }>("tafsir-center", "get_surah_statistics", { surah }),
    ),
  ]);

  if (!info && !stats) return null;

  return {
    surah,
    names: (info?.names ?? []).filter((name): name is string => Boolean(name)),
    nameGroups: surahNames(stats?.names_info),
    revelationType: str(info?.revelation_type),
    ayahCount: int(info?.ayah_count),
    virtues: str(info?.virtues),
    stats: stats
      ? {
          revelationOrder: int(stats.revelation_order),
          surahClass: str(stats.surah_class),
          wordCount: int(stats.word_count),
          charCount: int(stats.char_count),
          longestWord: str(stats.longest_word),
          mostFrequentWord: str(stats.most_freq_word),
          sujud: str(stats.sujud),
        }
      : null,
  };
};

/* ---------- علوم الآية ---------- */

export interface QeraatEntry {
  wordNo: number | null;
  /**
   * The word the readings differ over.
   *
   * «الكلمة ٤» told a reader which token to count to and nothing else, while
   * the variants under it describe a word they could not see — «قرأ بالهمزة، مع
   * سكون الفاء» is about «كُفُوًا», and saying so is the difference between a
   * block that can be read and one that can be decoded.
   *
   * Null when the word cannot be named with certainty; see `wordsOf`.
   */
  word: string | null;
  variants: { reader: string; reading: string }[];
}

export interface TafsirEntry {
  edition: string | null;
  /** The commentator and his death year, as the centre records it. */
  attribution: string | null;
  text: string;
}

export interface AyahSciences {
  surah: number;
  ayah: number;
  /** غريب القرآن for the whole āya. */
  gharib: string | null;
  /** إعراب الآية. */
  irab: string | null;
  /** أحكام التجويد. */
  tajweed: string | null;
  /** سبب النزول, or the centre's own statement that none is established. */
  nuzool: { established: boolean; text: string } | null;
  /** القراءات, per word, each variant under its reader. */
  qeraat: QeraatEntry[];
  /** التفاسير — the default editions, each under its own attribution. */
  tafsirs: TafsirEntry[];
  /** How many words the āya has, which bounds the word panel. */
  wordCount: number | null;
  /**
   * The approved translation of the āya's meaning.
   *
   * From موسوعة القرآن's own published edition, never generated — a translation
   * of revealed text is the last thing this system should compose for itself
   * when an approved one exists. It lives in this pane and nowhere else: the
   * answer used to carry a «ترجمة الآية» link of its own, which was one more
   * exit for something a reader already reaches by tapping the āya.
   */
  translation: { text: string; edition: string | null } | null;
}

export const ayahSciences = async (
  surah: number,
  ayah: number,
): Promise<AyahSciences> => {
  const [verse, nuzool, qeraat, tafsir, rendered] = await Promise.all([
    soft(
      payload<{
        gharib?: string;
        irab?: string;
        tajweed?: string;
        word_count?: number;
        /** The āya in the muṣḥaf's own spelling — what `word_no` counts. */
        text_uthmani?: string;
      }>("tafsir-center", "fetch_ayah", {
        surah,
        ayah,
        include: ["gharib", "irab", "tajweed"],
      }),
    ),
    soft(
      payload<{
        sources?: { available?: boolean; reason?: string; text?: string }[];
      }>("tafsir-center", "fetch_nuzool_reason", { surah, ayah }),
    ),
    soft(
      payload<{
        qeraat_entries?: {
          word_no?: number;
          variants?: { reader?: string; reading?: string }[];
        }[];
      }>("tafsir-center", "get_qeraat_variants", { surah, ayah }),
    ),
    soft(
      payload<{
        tafsirs?: {
          source?: string;
          attribution?: string;
          text?: string;
          text_clean?: string;
          available?: boolean;
        }[];
      }>("tafsir-center", "fetch_tafsir", {
        surah,
        ayah,
        /*
         * Every edition, not this reader's. The pane is a reference opened on
         * purpose; the level scopes the *answer*. See `ALL_TAFSIR_EDITIONS`.
         */
        sources: ALL_TAFSIR_EDITIONS,
      }),
    ),
    /*
     * The published English edition, read as a document so the translation
     * arrives separated from the verse — `toChunk` keeps the ʿUthmānī text as
     * the chunk's own and the rendering in `translation`, which is the split
     * that stops one being quoted as the other.
     */
    soft(fetchDocument(`quran:${surah}:${ayah}:en`)),
  ]);

  /*
   * The āya's words, by the centre's own division — or none at all.
   *
   * `word_no` indexes the centre's tokenisation, and splitting the ʿUthmānī
   * text on whitespace is *our* tokenisation of it. The two agree in practice,
   * but "in practice" is not a basis for printing one word where a reading
   * belongs to another: a qirāʾa attached to the wrong word is a claim about
   * the Qurʾān that the source did not make.
   *
   * So the split is checked against the count the centre itself reports, and
   * dropped entirely when they disagree. The block then shows «الكلمة ٤» as it
   * always did, which is poorer and still true.
   */
  const words = (() => {
    const expected = int(verse?.word_count);
    if (!expected) return [];

    /*
     * موسوعة القرآن's text first, مركز تفسير's second.
     *
     * Both are the same āya; only one of them is pointed. `fetch_ayah` returns
     * it stripped — «كفوا» — while the document already fetched for the
     * translation carries the muṣḥaf's own «كُفُوًا», which is what belongs
     * beside readings that turn on a hamza and a sukūn.
     */
    for (const candidate of [str(rendered?.text), str(verse?.text_uthmani)]) {
      if (!candidate) continue;
      const split = candidate.split(/\s+/).filter(Boolean);
      if (split.length === expected) return split;
    }
    return [];
  })();

  /*
   * «لم يثبت سبب نزول لهذه الآية» is a finding, not an empty result, and the
   * panel says so in the centre's words. A sabab the books do not carry is
   * routinely asserted anyway, so being able to state that none is established
   * is the useful answer.
   */
  const occasion = (nuzool?.sources ?? []).find(
    (entry) => str(entry.text) ?? str(entry.reason),
  );

  return {
    surah,
    ayah,
    gharib: str(verse?.gharib),
    irab: str(verse?.irab),
    tajweed: str(verse?.tajweed),
    wordCount: int(verse?.word_count),
    translation: (() => {
      const text = str(rendered?.metadata?.translation);
      return text
        ? { text, edition: str(rendered?.metadata?.translationEdition) }
        : null;
    })(),
    nuzool: occasion
      ? {
          established: occasion.available !== false,
          text:
            str(occasion.text) ??
            str(occasion.reason) ??
            "لم يثبت سبب نزول لهذه الآية في المصادر المعتمدة",
        }
      : null,
    qeraat: (qeraat?.qeraat_entries ?? []).flatMap((entry) => {
      const variants = (entry.variants ?? []).flatMap((variant) => {
        const reader = str(variant.reader);
        const reading = str(variant.reading);
        return reader && reading ? [{ reader, reading }] : [];
      });
      if (variants.length === 0) return [];

      const wordNo = int(entry.word_no);
      return [
        { wordNo, word: wordNo ? (words[wordNo - 1] ?? null) : null, variants },
      ];
    }),
    tafsirs: (tafsir?.tafsirs ?? []).flatMap((entry) => {
      if (entry.available === false) return [];
      const text = str(entry.text_clean) ?? str(entry.text);
      return text
        ? [
            {
              edition: str(entry.source),
              attribution: str(entry.attribution),
              text,
            },
          ]
        : [];
    }),
  };
};

/* ---------- علوم الكلمة ---------- */

export interface WordSciences {
  surah: number;
  ayah: number;
  wordNo: number;
  /**
   * The word the centre analysed, in its own orthography.
   *
   * Always shown as the panel's heading, and that is a correctness measure
   * rather than a label. The displayed verse is the ʿUthmānī text from موسوعة
   * القرآن while the word index is resolved against مركز تفسير's own tokens;
   * the two follow the same muṣḥaf word division — checked across 2:153,
   * 112:2, 16:125 and 2:286, the last of them 49 words — but naming the word
   * that was analysed means any divergence is visible to the reader instead of
   * quietly handing them another word's grammar.
   */
  word: string | null;
  /** المعنى. */
  meaning: string | null;
  /** مشكل الإعراب للكلمة. */
  irab: string | null;
  /** التصريف. */
  sarf: string | null;
  /** ملاحظة الرسم, where the ʿUthmānī spelling itself needs explaining. */
  rasm: string | null;
  root: string | null;
  /** إحصاءات الجذر: تكراره وتوزيعه. */
  rootStats: {
    occurrences: number | null;
    surahs: number | null;
    ayahs: number | null;
    forms: number | null;
  } | null;
}

/** Diacritics only — the letters, and therefore the root, are left alone. */
const DIACRITICS = /[ً-ْٰـ]/g;

/**
 * Exported for its test, which exists because the first version of this matched
 * nothing: «مَادَّةِ» carries three diacritics and the pattern had none.
 */
export const rootFromSarf = (sarf: unknown) => {
  const text = str(sarf);
  if (!text) return null;
  const found = /مادة\s*:?\s*\(([^)]+)\)/u.exec(text.replace(DIACRITICS, ""));
  return str(found?.[1]);
};

export const wordSciences = async (
  surah: number,
  ayah: number,
  wordNo: number,
): Promise<WordSciences | null> => {
  const word = await soft(
    payload<{
      word_no?: number;
      word?: string;
      meaning?: string;
      irab?: string;
      sarf?: string;
      root?: string;
      rasm_note?: string;
    }>("tafsir-center", "analyze_word", { surah, ayah, word_no: wordNo }),
  );
  if (!word) return null;

  /*
   * The root, which `analyze_word` returns as null for every word tested — but
   * states in the ṣarf field, as «مِنْ مَادَّةِ: (أله)». So it is read from
   * there when the dedicated field is empty.
   *
   * Reading the centre's own stated مادة is not the same as deriving a root
   * ourselves: the value is the source's, and «أله», «صمد», «عون», «دعو»,
   * «رحم» and «كلف» were all extracted this way and all resolve in
   * `get_root_stats`. Without it the whole إحصاءات الجذر block — which the
   * specification names — would never once appear.
   *
   * The diacritics are stripped before matching and only then: «مَادَّةِ»
   * carries three of them, which is why the first pattern matched nothing at
   * all, and the captured root keeps its own hamza because the capture comes
   * from inside the parentheses.
   */
  const root = str(word.root) ?? rootFromSarf(word.sarf);
  const stats = root
    ? await soft(
        payload<{
          found?: boolean;
          occurrences?: number;
          surahs_count?: number;
          ayahs_count?: number;
          distinct_forms?: number;
        }>("tafsir-center", "get_root_stats", { root }),
      )
    : null;

  return {
    surah,
    ayah,
    wordNo: int(word.word_no) ?? wordNo,
    word: str(word.word),
    meaning: str(word.meaning),
    irab: str(word.irab),
    sarf: str(word.sarf),
    rasm: str(word.rasm_note),
    root,
    rootStats:
      stats && stats.found !== false
        ? {
            occurrences: int(stats.occurrences),
            surahs: int(stats.surahs_count),
            ayahs: int(stats.ayahs_count),
            forms: int(stats.distinct_forms),
          }
        : null,
  };
};
