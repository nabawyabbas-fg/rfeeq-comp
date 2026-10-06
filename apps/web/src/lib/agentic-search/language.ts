import type { ModelMessage } from "ai";

/**
 * Works out what language the question is in, so the pipeline can name it
 * explicitly instead of asking the model to infer it.
 *
 * The system prompt has told the model to "answer in the language the user
 * asked in" since the beginning, and says so twice as of the latest revision.
 * It is still ignored: across 240 evaluation runs, Arabic questions were
 * answered in English 5 times under the old wording and 6 under the new one.
 * An instruction the model has to resolve for itself is one it can quietly get
 * wrong; an instruction that says "write in Arabic" is not.
 */

/**
 * Strips the markup an answer carries, so only what the model *wrote* is
 * counted.
 *
 * Load-bearing, not tidiness. The answer templates open with structural
 * sections — `<part k="matn" ref="hadeethenc-4560#0"></part>` — whose markers
 * are pure Latin, and citation ids like `web-islamqa-info-1mbg1ub#5` are too.
 * A short Arabic answer can therefore open with a hundred Latin letters and no
 * Arabic at all, which read as an English answer to an Arabic question and got
 * the whole thing discarded and regenerated. The hadith templates failed this
 * way every single time, since all three of their opening sections are
 * structural.
 */
export const prose = (text: string) =>
  text
    .replace(/<[^>]*>/g, " ")
    // a tag still arriving has no ">" yet and would otherwise survive intact
    .replace(/<[^>]*$/, " ");

/** Latin and Arabic letter counts decide it; anything else is inconclusive. */
export const detectLanguage = (text: string): "ar" | "en" | null => {
  const arabic = (text.match(/[؀-ۿ]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  // a couple of stray characters should not decide the answer's language
  if (arabic + latin < 8) return null;

  /*
   * Not a majority test. The two scripts are not symmetric here: Arabic
   * questions routinely carry Latin technical terms — "ما حكم bitcoin؟" is five
   * Arabic letters against seven Latin and is plainly an Arabic question —
   * while English questions almost never embed Arabic script beyond a quoted
   * term. So any substantial share of Arabic means the question is Arabic.
   */
  const arabicShare = arabic / (arabic + latin);
  if (arabicShare >= 0.3) return "ar";
  if (latin > 0) return "en";
  return null;
};

/** The question being answered — the last thing the user actually asked. */
export const questionLanguage = (
  messages: ModelMessage[],
): "ar" | "en" | null => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role !== "user") continue;
    const text =
      typeof m.content === "string"
        ? m.content
        : m.content.map((part) => ("text" in part ? part.text : "")).join(" ");
    return detectLanguage(text);
  }
  return null;
};

const NAME = { ar: "Arabic", en: "English" } as const;

/**
 * Appended to the system prompt for the run, and re-asserted immediately before
 * the answer is written. Deliberately short and concrete: it names one language
 * and leaves nothing to interpret.
 */
export const languageDirective = (lang: "ar" | "en" | null): string =>
  lang
    ? `\n\n<language_lock>\nThe user asked in ${NAME[lang]}. Write the entire answer in ${NAME[lang]} — every heading, every sentence, every aside. Quotations from the sources stay in their original language; everything you write yourself is ${NAME[lang]}.\n</language_lock>`
    : "";
