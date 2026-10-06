import type { FormattedChunk } from "@/lib/agentic-search/format-chunk";
import type { Expertise } from "@/lib/rfeeq/expertise";
import type { RfeeqIntent } from "@/lib/rfeeq/intent";
import type { ToolSet } from "ai";
import { env } from "@/env";
import { answerEditionsFor } from "@/lib/rfeeq/expertise";
import { tool } from "ai";
import { z } from "zod/v4";

import { searchDomainsFor } from "./allowlist";
import { SourceUnavailableError } from "./client";
import { fetchDocuments } from "./mcp/documents";
import { quranUsage, usageChunk } from "./mcp/lexicon";
import * as mcpQuran from "./mcp/quran";
import { searchEncyclopedias } from "./mcp/search";
import * as mcpTafsir from "./mcp/tafsir";
import * as terminology from "./terminology";
import { withDorarRulings } from "./dorar";
import { searchApprovedWebExpanded } from "./web-search";

/**
 * Retrieval tools over the challenge's approved platforms.
 *
 * These call the sources live rather than searching an ingested copy, which is
 * what the brief's allow-list makes possible: the platforms publish read-only
 * interfaces, so a claim can be traced to the source at the moment it is made
 * instead of to a snapshot of unknown age.
 *
 * Most of them are now reached over the servers the publishers run for exactly
 * this purpose — the brief lists one as part of their availability, «واجهات
 * برمجية عامة، قاعدة مركزية موحّدة، وخادم MCP». Two things changed when they
 * replaced the REST adapters, and both are visible in the tools below.
 *
 * **The catalogues became searchable.** The REST APIs are browsed by category
 * and fetched by id, so an agent had to guess which of 493 chapters a hadith
 * might sit in before it could read one. These servers take a query. The
 * category-browsing tools are gone with the guessing they existed to support;
 * when a search finds nothing the fallback is `approved_web_search`, which
 * reaches the platforms that carry the weak and the fabricated reports *with*
 * their gradings — a better fallback than a chapter listing ever was.
 *
 * **The grading became structured.** A hadith document arrives with `grade` and
 * `attribution` as fields, so «لا ينسب حديث دون مصدر وحكم معتمد في البيانات» is
 * checked in `mcp/documents.ts` rather than entrusted to a prompt. A report
 * missing either is dropped before it can be cited.
 *
 * What has not changed: **navigation output is deliberately not citable.** The
 * search tools return `{ results }` rather than a bare array, because the
 * citation layer treats any array a tool returns as retrieved passages. A
 * search hit is a candidate — it carries no grading — and shaping it so it
 * cannot be cited is cheaper than remembering not to cite it.
 */

/** Phrased for the model: what went wrong, and what to do about it. */
const unavailable = (error: unknown) => {
  if (error instanceof SourceUnavailableError) {
    return {
      unavailable: true,
      message:
        `تعذّر الوصول إلى ${error.host}. Do not substitute another source or ` +
        `your own knowledge: say that the source could not be reached and ` +
        `that the point is therefore unverified.`,
    } as const;
  }
  throw error;
};

const quranVerse = tool({
  description:
    "Fetch the canonical text of a Qurʾānic verse, or a short range of verses, " +
    "from the approved Qurʾān encyclopedia. Returns the ʿUthmānī text with " +
    "full diacritics plus an approved translation. Use this whenever a verse " +
    "is quoted, referred to, or needs checking — never reproduce a verse from " +
    "memory. If you know roughly what a verse says but not where it is, use " +
    "quran_search first.",
  inputSchema: z.object({
    sura: z.number().int().min(1).max(114).describe("Sūra number, 1–114."),
    aya: z.number().int().min(1).describe("Āya number."),
    throughAya: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe("Last āya of a range. Omit for a single verse. Max 20."),
  }),
  execute: async ({ sura, aya, throughAya }) => {
    try {
      return await mcpQuran.getVerses(sura, aya, throughAya ?? aya);
    } catch (error) {
      return unavailable(error);
    }
  },
});

const quranSearch = tool({
  description:
    "Find verses by their wording. Matching ignores diacritics, so pass the " +
    "words as a reader would type them («الصابرين», «لا يكلف الله نفسا»). " +
    "Returns the matching verses in the canonical pointed text, ready to " +
    "quote. Use this to locate a verse the reader half-remembers, or to check " +
    "whether a phrase they attribute to the Qurʾān is in it at all — a phrase " +
    "that finds nothing here is not a verse, and saying so is the answer.",
  inputSchema: z.object({
    query: z
      .string()
      .min(2)
      .describe("Arabic words from the verse, with or without diacritics."),
    limit: z.number().int().min(1).max(20).default(5),
  }),
  execute: async ({ query, limit }) => {
    try {
      const chunks = await mcpQuran.searchVerses(query, { limit });
      if (chunks.length === 0) {
        return {
          empty: true,
          message:
            `No verse in the Qurʾān contains «${query}». If the reader ` +
            `attributed it to the Qurʾān, say plainly that it is not a verse.`,
        } as const;
      }
      return chunks;
    } catch (error) {
      return unavailable(error);
    }
  },
});

const surahInfo = tool({
  description:
    "Fetch a sūra's own data from the approved source: its name or names, " +
    "whether it was revealed at Mecca or Medina, its āya count, and the " +
    "reports on its virtues. Use this instead of naming a sūra from memory.",
  inputSchema: z.object({
    sura: z.number().int().min(1).max(114),
  }),
  execute: async ({ sura }) => {
    try {
      const info = await mcpQuran.getSurahInfo(sura);
      return info ?? { empty: true, message: "The source returned no data." };
    } catch (error) {
      return unavailable(error);
    }
  },
});

const hadithSearch = tool({
  description:
    "Search the approved hadith encyclopedia. Write the phrase in the wording " +
    "the books use rather than the wording the question used — a masʾala or a " +
    "chapter heading («الجمع بين الصلاتين»), not a question («هل يجوز أن " +
    "أجمع؟»). Returns candidates only: read one with read_sources to get it " +
    "with its grading, which the search results do not carry. This " +
    "encyclopedia holds only authenticated reports, so a weak or fabricated " +
    "hadith is ABSENT from it rather than graded by it — absence here is " +
    "evidence of nothing on its own. When a hadith is not found, use " +
    "approved_web_search to check الموسوعة الحديثية on dorar, which carries " +
    "the weak ones with their gradings, before saying anything about it.",
  inputSchema: z.object({
    phrase: z
      .string()
      .min(2)
      .describe("Arabic phrase, shaped like a chapter heading."),
    limit: z.number().int().min(1).max(25).default(10),
  }),
  execute: async ({ phrase, limit }) => {
    try {
      return {
        results: await searchEncyclopedias(phrase, {
          corpora: ["hadith"],
          limit,
        }),
      };
    } catch (error) {
      return unavailable(error);
    }
  },
});

const librarySearch = tool({
  description:
    "Search the approved Islamic content encyclopedia — books, articles, " +
    "lessons and answers on belief, worship, daʿwa and questions about Islam, " +
    "reviewed and published in over a hundred languages. Returns candidates " +
    "only: read one with read_sources. Pass the subject as the material would " +
    "title it. Use the `language` argument to find material in the reader's " +
    "own language rather than translating Arabic material yourself.",
  inputSchema: z.object({
    query: z.string().min(2).describe("Subject, as the material would title it."),
    language: z
      .string()
      .default("ar")
      .describe("ISO code, e.g. ar, en, fr, id, ur."),
    limit: z.number().int().min(1).max(25).default(10),
  }),
  execute: async ({ query, language, limit }) => {
    try {
      return {
        results: await searchEncyclopedias(query, {
          corpora: ["library"],
          language,
          limit,
        }),
      };
    } catch (error) {
      return unavailable(error);
    }
  },
});

const readSources = tool({
  description:
    "Read documents in full from the approved encyclopedias, by the ids a " +
    "search returned. Pass ids exactly as given — never build one yourself. " +
    "A hadith comes back with its matn, its grading and its attribution; one " +
    "whose grading the source does not carry is NOT returned, and in that " +
    "case say no authenticated report was found rather than citing it. The " +
    "publisher's explanation travels separately from the text: summarise it " +
    "with attribution if useful, but never quote it as the words of the " +
    "Prophet or of the Qurʾān.",
  inputSchema: z.object({
    ids: z
      .array(z.string().min(3))
      .min(1)
      .max(5)
      .describe("Document ids from a search result."),
  }),
  execute: async ({ ids }) => {
    try {
      /*
       * Every hadith read is accompanied by الدرر السنية's rulings on the same
       * matn — the brief puts `dorar.net/hadith` in the hadith row, and leaving
       * it to the model meant it was never consulted: موسوعة الحديث answers
       * with one grading and the model stops there. Soft by construction, so a
       * slow or empty Dorar search costs the answer nothing.
       */
      return await withDorarRulings(
        await fetchDocuments(ids),
        env.OPENAI_API_KEY,
      );
    } catch (error) {
      return unavailable(error);
    }
  },
});

/**
 * Commentary on one āya, from the editions this reader's level is served.
 *
 * Built per level rather than taking the level as an argument, for the same
 * reason the web search is built per intent: a model cannot choose wrongly
 * between things it was never offered. «تختلف المصادر بحسب مستوى السائل» is a
 * decision about the reader, and the reader is not something the model should
 * be re-deciding mid-answer.
 */
const tafsirGet = (expertise: Expertise | undefined) =>
  tool({
    description:
      "Fetch the classical commentary on one āya from the approved Qurʾānic " +
      "studies centre. The editions are chosen for this reader already — do " +
      "not ask for others. Returns each edition's text under the " +
      "commentator's own name and death year. Quote it AS the commentator's " +
      "words: the brief requires the mufassir's speech to be distinguishable " +
      "from the verse itself, so fetch the verse with quran_verse and the " +
      "commentary here, and never let the two run together. When more than " +
      "one edition comes back and they differ, present that as a difference " +
      "among scholars rather than picking one; when one comes back, give its " +
      "meaning once — the reader reaches the other editions through علوم " +
      "الآية, so there is nothing to compare against here. Also returns, when the centre covers this āya, " +
      "غريب القرآن — its difficult words explained phrase by phrase — and " +
      "هدايات الآية, the centre's own «فوائد» material. Use them for the " +
      "«غريب القرآن» and «من فوائد الآيات» sections; omit a section only when " +
      "nothing came back for it.",
    inputSchema: z.object({
      sura: z.number().int().min(1).max(114),
      aya: z.number().int().min(1),
    }),
    execute: async ({ sura, aya }) => {
      try {
        /*
         * The commentary and the two folded sections in one call. They were
         * never fetched, so «غريب القرآن» and «من فوائد الآيات» had nothing
         * behind them and the model — correctly — wrote neither: two of a
         * commentary answer's five sections never appeared.
         */
        const [chunks, extras] = await Promise.all([
          mcpTafsir.fetchTafsir(sura, aya, answerEditionsFor(expertise)),
          mcpTafsir.fetchAyahExtras(sura, aya).catch(() => []),
        ]);
        if (chunks.length === 0) {
          return {
            empty: true,
            message:
              "No approved edition covers this āya. Say so rather than " +
              "supplying commentary of your own.",
          } as const;
        }
        return [...chunks, ...extras];
      } catch (error) {
        return unavailable(error);
      }
    },
  });

const tafsirSources = tool({
  description:
    "List the commentary editions available, with each one's coverage. Use " +
    "this only when the reader asks which commentaries are consulted, or when " +
    "a specific edition is wanted; tafsir_get has sensible defaults.",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      return { editions: await mcpTafsir.listTafsirSources() };
    } catch (error) {
      return unavailable(error);
    }
  },
});

const nuzoolReason = tool({
  description:
    "Fetch the occasion of an āya's revelation (سبب النزول) from the approved " +
    "sources. When they establish none, this says so — and that is a finding " +
    "worth reporting, because a sabab the books do not carry is routinely " +
    "asserted anyway. Do not supply one from memory.",
  inputSchema: z.object({
    sura: z.number().int().min(1).max(114),
    aya: z.number().int().min(1),
  }),
  execute: async ({ sura, aya }) => {
    try {
      const result = await mcpTafsir.fetchNuzoolReason(sura, aya);
      return result.established
        ? result.chunks
        : ({ empty: true, message: result.reason } as const);
    } catch (error) {
      return unavailable(error);
    }
  },
});

const quranUsageTool = tool({
  description:
    "Look up how a word is used in the Qurʾān: its root, how many times that " +
    "root occurs, in how many sūras and āyas, and the forms it takes with an " +
    "example of each. Use it for a question about a word's own meaning — it " +
    "is what the الاستعمال القرآني section is built from. Pass the word as the " +
    "reader wrote it; the lookup strips the article itself when it has to. " +
    "Returns nothing for a word the Qurʾān does not use, which is a fair " +
    "outcome and means the section should be dropped, not filled with a zero.",
  inputSchema: z.object({
    word: z
      .string()
      .min(2)
      .describe("The Arabic word, as the reader wrote it."),
  }),
  execute: async ({ word }) => {
    try {
      const usage = await quranUsage(word);
      if (!usage) {
        return {
          empty: true,
          message:
            `«${word}» does not occur in the Qurʾān in a form the ` +
            `concordance recognises. Drop the Qurʾānic-usage section rather ` +
            `than reporting a count of zero.`,
        } as const;
      }
      return [usageChunk(usage)];
    } catch (error) {
      return unavailable(error);
    }
  },
});

const termCategories = tool({
  description:
    "List the subject tree of the approved Islamic terminology encyclopedia.",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      return { categories: await terminology.getCategories() };
    } catch (error) {
      return unavailable(error);
    }
  },
});

const termList = tool({
  description:
    "List terms in one category of the approved terminology encyclopedia. " +
    "Returns ids and headwords only.",
  inputSchema: z.object({
    categoryId: z.string(),
    page: z.number().int().min(1).default(1),
  }),
  execute: async ({ categoryId, page }) => {
    try {
      return { terms: await terminology.listByCategory(categoryId, { page }) };
    } catch (error) {
      return unavailable(error);
    }
  },
});

const termGet = tool({
  description:
    "Fetch one term from the approved terminology encyclopedia, in a chosen " +
    "language. Passing a non-Arabic language returns that language's APPROVED " +
    "equivalent and its definition — use this instead of translating a " +
    "religious term yourself. The approved equivalent outranks a fluent " +
    "rendering, however natural the latter sounds.",
  inputSchema: z.object({
    id: z.string().describe("Term id from a listing."),
    language: z
      .string()
      .default("ar")
      .describe("ISO code, e.g. ar, en, fr, id, ur."),
  }),
  execute: async ({ id, language }) => {
    try {
      const chunk = await terminology.getTerm(id, language);
      return chunk ? [chunk] : [];
    } catch (error) {
      return unavailable(error);
    }
  },
});

/**
 * Search the approved websites for an intent that has no API.
 *
 * Built per intent rather than as one tool, because the domains it is locked to
 * are the intent's own: a shubuhat question may read the دعوة platforms, a fiqh
 * question may read the fatwa bodies, and neither may read the other's.
 */
const approvedWebSearch = (intent: RfeeqIntent) =>
  tool({
    description:
      "Search the approved websites for this subject. Pass the reader's " +
      "question as they asked it — this tool rewrites it into the phrasings " +
      "the sources are actually titled in (a masʾala heading for the fiqh " +
      "encyclopedias, a question title for the fatwa sites, the jurists' " +
      "technical term, and an evidence-seeking form) and searches all of them. " +
      "Do not pre-translate or re-shape the question yourself; that work " +
      "happens here, and a question already rewritten once loses the reader's " +
      "own wording. The search is locked to approved domains server-side, so a " +
      "result from anywhere else cannot appear. If it returns nothing, say the " +
      "approved sources do not address it rather than answering from memory.",
    inputSchema: z.object({
      question: z
        .string()
        .min(3)
        .describe(
          "The reader's question, as close to how they asked it as possible.",
        ),
    }),
    execute: async ({ question }) => {
      const domains = searchDomainsFor(intent);
      try {
        const { chunks, rejected, variants } = await searchApprovedWebExpanded(
          question,
          domains,
          env.OPENAI_API_KEY,
        );
        /*
         * A rejected citation means the server-side filter did not hold. It has
         * not happened in testing, and if it ever does the run should say so
         * rather than quietly continue on a narrowed result set.
         */
        if (rejected.length > 0) {
          return {
            unavailable: true,
            message:
              `The domain lock did not hold — ${rejected.length} citation(s) ` +
              `came from outside the approved list and were discarded. Treat ` +
              `this search as having returned nothing.`,
          } as const;
        }
        /*
         * Nothing found is reported with the phrasings that were tried, so the
         * answer can say what was searched for rather than only that it failed
         * — which is the difference between «لم يرد في المصادر المعتمدة» and a
         * bare silence the reader cannot evaluate.
         */
        if (chunks.length === 0) {
          return {
            empty: true,
            searched: variants.map((variant) => variant.query),
            message:
              "The approved sources returned nothing for any of these " +
              "phrasings. Say so, and name what was searched for.",
          } as const;
        }
        return chunks;
      } catch (error) {
        return unavailable(error);
      }
    },
  });

/**
 * Which approved platform may answer which intent.
 *
 * The allow-list's domain table, read as routing. A terminology question has no
 * business reaching the hadith encyclopedia, and offering a tool is the clearest
 * way to say so — a model cannot misuse a tool it was not given.
 *
 * Every intent now has at least one live approved source. That is the change
 * the publishers' own servers made: `aqida`, `sira-history`, `shubuhat` and
 * `dawa` previously had no adapter at all and fell back to the ingested corpus,
 * and they now reach the reviewed material in موسوعة المحتوى الإسلامي
 * alongside the domain-locked web search.
 */
const byIntent = (
  expertise: Expertise | undefined,
): Partial<Record<RfeeqIntent, ToolSet>> => ({
  quran: {
    quran_verse: quranVerse,
    quran_search: quranSearch,
    surah_info: surahInfo,
  },
  /*
   * Commentary quotes the verse it comments on, so it needs the canonical text
   * from one source and the mufassir's words from another — which is the brief's
   * تمييز كلام المفسر عن النص القرآني expressed as two separate tools.
   */
  tafsir: {
    quran_verse: quranVerse,
    quran_search: quranSearch,
    tafsir_get: tafsirGet(expertise),
    tafsir_sources: tafsirSources,
    nuzool_reason: nuzoolReason,
    surah_info: surahInfo,
    approved_web_search: approvedWebSearch("tafsir"),
  },
  hadith: {
    hadith_search: hadithSearch,
    read_sources: readSources,
    /*
     * The encyclopedia holds only authenticated reports, so a weak or
     * fabricated one is absent from it rather than graded by it. This reaches
     * الموسوعة الحديثية on dorar, which carries the weak ones with their
     * gradings — without it, «لم أجد» is the best this intent could ever do
     * about a widely circulated hadith that does not stand up.
     */
    approved_web_search: approvedWebSearch("hadith"),
    // a hadith commonly turns on a verse it cites
    quran_verse: quranVerse,
    quran_search: quranSearch,
  },
  /*
   * A word's meaning, which the brief files under اللغة العربية والمعاجم: the
   * terminology encyclopedia for the اصطلاحي sense, the approved dictionaries
   * through a domain-locked search for the لغوي one, and the concordance for
   * how the Qurʾān actually uses it.
   */
  language: {
    quran_usage: quranUsageTool,
    term_categories: termCategories,
    term_list: termList,
    term_get: termGet,
    hadith_search: hadithSearch,
    read_sources: readSources,
    approved_web_search: approvedWebSearch("language"),
  },
  terminology: {
    term_categories: termCategories,
    term_list: termList,
    term_get: termGet,
    /*
     * موسوعة الجمهرة, which the brief ranks above automatic translation for
     * sensitive terms. The terminology encyclopedia's own API is addressed by
     * id and cannot be searched by phrase, so without this a reader who names a
     * term rather than browsing to it had no way to reach either dictionary.
     */
    approved_web_search: approvedWebSearch("terminology"),
  },
  /*
   * The fatwa bodies and fiqh encyclopedias publish no usable API, so they are
   * reached by a search locked to their domains. This is where open-ended
   * questions land.
   */
  fiqh: {
    approved_web_search: approvedWebSearch("fiqh"),
    quran_verse: quranVerse,
    quran_search: quranSearch,
    hadith_search: hadithSearch,
    read_sources: readSources,
  },
  aqida: {
    approved_web_search: approvedWebSearch("aqida"),
    library_search: librarySearch,
    read_sources: readSources,
    quran_verse: quranVerse,
    hadith_search: hadithSearch,
  },
  "sira-history": {
    approved_web_search: approvedWebSearch("sira-history"),
    library_search: librarySearch,
    read_sources: readSources,
    hadith_search: hadithSearch,
  },
  /*
   * A shubuhat question is answered with the dialogical material the brief
   * names for it, and routinely turns on a verse or a report that the doubt
   * misquotes — so the two checking tools are here as well.
   */
  shubuhat: {
    approved_web_search: approvedWebSearch("shubuhat"),
    library_search: librarySearch,
    read_sources: readSources,
    quran_search: quranSearch,
    quran_verse: quranVerse,
    hadith_search: hadithSearch,
  },
  dawa: {
    approved_web_search: approvedWebSearch("dawa"),
    library_search: librarySearch,
    read_sources: readSources,
    quran_verse: quranVerse,
  },
  /* a ruling question about the asker's own case still reads the fiqh material;
     what changes is the answer contract, not the sources */
  "fatwa-referral": {
    approved_web_search: approvedWebSearch("fiqh"),
    quran_verse: quranVerse,
    hadith_search: hadithSearch,
    read_sources: readSources,
  },
});

/**
 * The live source tools a question may use.
 *
 * Empty for an intent with no approved adapter, which leaves the run with its
 * ingested corpus alone — the honest outcome, rather than quietly widening the
 * allow-list to whatever is nearest.
 */
export const sourceToolsFor = (
  intent: RfeeqIntent,
  /**
   * Which editions the commentary tool reads, from the reader's own level.
   *
   * Taken here rather than inside the tool so that the whole set is built once
   * per turn and the model is never offered a choice that belongs to the
   * reader — «تختلف المصادر بحسب مستوى السائل».
   */
  expertise?: Expertise,
): ToolSet => byIntent(expertise)[intent] ?? {};

/**
 * Every source tool, for surfaces that do not classify intent.
 *
 * Built for the general reader, since a surface that does not classify a
 * question does not know who is asking either — and the general editions are
 * the safer of the two to serve blind.
 */
export const allSourceTools: ToolSet = {
  quran_verse: quranVerse,
  quran_usage: quranUsageTool,
  quran_search: quranSearch,
  surah_info: surahInfo,
  hadith_search: hadithSearch,
  library_search: librarySearch,
  read_sources: readSources,
  tafsir_get: tafsirGet("general"),
  tafsir_sources: tafsirSources,
  nuzool_reason: nuzoolReason,
  term_categories: termCategories,
  term_list: termList,
  term_get: termGet,
};

export type { FormattedChunk };
