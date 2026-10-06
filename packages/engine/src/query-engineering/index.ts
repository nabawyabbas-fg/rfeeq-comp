import type { LanguageModel } from "ai";
import { generateObject } from "ai";
import { z } from "zod/v4";

/**
 * Turns a user's question into a set of retrieval queries written in the
 * vocabulary the corpus actually uses.
 *
 * The corpus is classical Arabic scholarship; users ask in modern vernacular,
 * often in another language entirely. A literal search for "is a mortgage
 * halal" finds nothing, because the texts discuss `الإجارة المنتهية بالتمليك`
 * and `بيع الوفاء`. Retrieval quality is bounded by this translation step long
 * before it is bounded by the embedding model.
 */

export const DOMAINS = [
  "fiqh",
  "usul",
  "aqida",
  "tafsir",
  "hadith",
  "rijal",
  "tarikh",
  "other",
] as const;

export type Domain = (typeof DOMAINS)[number];

/**
 * Why a given search exists. Ruling questions need deliberate coverage of
 * opposing positions, otherwise retrieval returns whichever view happens to be
 * best represented in the index and the answer reads as settled when it is not.
 */
export const FACETS = [
  "core", // the central question
  "permitting", // evidence for permissibility
  "prohibiting", // evidence for prohibition
  "conditions", // shurūṭ, mawāniʿ, qualifications
  "evidence", // Qur'anic/hadith proof texts
  "definition", // how the term is defined in the literature
] as const;

const searchSchema = z.object({
  query: z
    .string()
    .describe("The search query, written in classical Arabic."),
  mode: z
    .enum(["semantic", "keyword", "hybrid"])
    .describe(
      "keyword for exact phrases, names and technical terms; semantic for conceptual questions; hybrid when both matter.",
    ),
  facet: z.enum(FACETS),
  label: z
    .string()
    .describe("Short human-readable description, in the user's language."),
});

const planSchema = z.object({
  language: z.string().describe("BCP-47 code of the user's language."),
  domains: z.array(z.enum(DOMAINS)).min(1),
  isRulingQuestion: z
    .boolean()
    .describe("True if the user is asking whether something is permitted."),
  classicalTerms: z
    .array(z.string())
    .describe("Classical Arabic terms this question maps onto."),
  searches: z.array(searchSchema).min(1).max(8),
});

export type SearchPlan = z.infer<typeof planSchema>;
export type PlannedSearch = z.infer<typeof searchSchema>;

const SYSTEM_PROMPT = `You plan retrieval over a corpus of classical Arabic Islamic scholarship (tafsīr, hadith and its commentaries, the four Sunni madhhabs, uṣūl, ʿaqīda, biography, history).

Your job is to convert a user's question into search queries that will actually match the language of those texts.

RULES

1. Every query MUST be in classical Arabic, whatever language the user wrote in.

2. Map modern and colloquial concepts onto the technical vocabulary the jurists used. The user's words are almost never the corpus's words.
   "mortgage" -> الإجارة المنتهية بالتمليك، بيع الوفاء، الرهن
   "credit card" -> بطاقات الائتمان، التكييف الفقهي للضمان والوكالة
   "margin trading" -> الجمع بين سلف وبيع، التورق المنظم
   "insurance" -> التأمين التجاري، التأمين التعاوني، الغرر
   "crypto" -> النقود الاصطلاحية، الثمنية، المالية في الاصطلاح الفقهي

3. Choose the mode deliberately:
   - keyword: exact hadith wording, a scholar's name, a book title, a fixed legal maxim (qāʿida), a chapter heading (bāb).
   - semantic: conceptual or thematic questions, paraphrases, modern scenarios.
   - hybrid: when a specific term must appear AND the surrounding discussion matters.

4. If the question asks whether something is permitted, do NOT search only for the answer you expect. Emit separate searches for the permitting evidence, the prohibiting evidence, and the conditions/qualifications. A one-sided retrieval produces a one-sided answer.

5. Prefer the phrasing a jurist would use as a chapter title or topic sentence. Classical books are organised by bāb and masʾala; queries shaped like those headings match far better than questions.

6. 2-3 searches for a simple factual question. 4-6 for a disputed ruling or a comparison across madhhabs. Never pad with near-duplicates — each search must cover different ground.`;

export interface PlanSearchesOptions {
  model: LanguageModel;
  query: string;
  /** Extra instruction, e.g. restricting to one madhhab. */
  guidance?: string;
}

export const planSearches = async ({
  model,
  query,
  guidance,
}: PlanSearchesOptions): Promise<SearchPlan> => {
  const { object } = await generateObject({
    model,
    schema: planSchema,
    system: SYSTEM_PROMPT,
    prompt: guidance ? `${query}\n\nAdditional guidance: ${guidance}` : query,
  });

  return object;
};
