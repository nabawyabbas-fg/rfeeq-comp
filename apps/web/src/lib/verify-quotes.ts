import type { MyUIMessage } from "@/types/ai";
import { retrievalChunks } from "@/lib/tool-output";

/**
 * Flags quoted scripture that does not appear in the passages actually
 * retrieved for the conversation.
 *
 * A user reported an answer quoting al-Māʾida 90 with `عَوْمَل` in place of
 * `عَمَل` — a corrupted word inside ﴿ ﴾. Across 120 evaluation runs, about a
 * quarter of Qurʾānic and hadith quotations could not be traced to the passages
 * cited beside them. The prompt now forbids quoting from memory, but a prompt
 * cannot guarantee it: the model has no way to check its own output. This does
 * the checking, at render time, against the evidence already in the message.
 *
 * Quotes are flagged, never removed. Silently deleting a verse would change the
 * scholarship on the reader's behalf; showing it with an honest warning lets
 * them judge.
 */

/**
 * Orthographic normalisation matching the retrieval side: drop tashkīl, dagger
 * alef and tatwīl, and fold the letter forms that vary between editions. Without
 * this, a correctly quoted verse would be flagged merely for carrying different
 * vowel marks than the printed source.
 *
 * The **Qurʾānic annotation marks go with them**. They used to survive the first
 * pass and be caught by the catch-all below, which turns anything unrecognised
 * into a *space* — so «بِٱلۡحِكۡمَةِ» normalised to «بال حك مه», three words
 * where the source has one, and a correctly quoted verse stopped matching the
 * plain-script writing of itself. Removing rather than spacing them can only
 * make more quotations match, never fewer, which is the safe direction for a
 * check whose failure mode is flagging sound text.
 */
export const normaliseArabic = (input: string): string =>
  input
    .replace(/[ً-ْٰـ]/g, "")
    // U+06D6–U+06ED and the open tanwīn: waqf signs, small letters, sajda marks
    .replace(/[\u06D6-\u06ED\u08F0-\u08F2\u065C\u065E\u065F]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ؤئ]/g, "ء")
    .replace(/[^ء-ي\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Every retrieved passage in the conversation, normalised into one haystack. */
export const collectSourceText = (messages: MyUIMessage[]): string => {
  const parts: string[] = [];
  for (const message of messages) {
    for (const part of message.parts) {
      /*
       * Every retrieval tool's passages, not just the two built-in ones.
       *
       * A search returns a bare array, or — when the question named a book or
       * author — `{ scope, chunks }`; the refusal shapes carry no chunks at
       * all. `retrievalChunks` reads all of those, and reads them from any
       * tool, which matters as much: a verse fetched from an allow-listed
       * source would otherwise be absent from the haystack and the model's
       * correct quotation of it flagged unverified.
       */
      for (const chunk of retrievalChunks(part)) {
        if (chunk.text) parts.push(chunk.text);
      }
    }
  }
  return normaliseArabic(parts.join(" \n "));
};

/** Quranic ﴿ ﴾ and hadith « » spans, the two forms the prompt requires. */
const QUOTE = /(﴿[^﴾]{8,600}﴾|«[^»]{12,600}»)/g;

/**
 * Arabic puts a book's title in « » as well, and that is not a quotation.
 *
 * «المقاصد الحسنة», «ذخيرة الحفاظ», «شعب الإيمان» — a hadith answer naming the
 * works that graded a report is full of these, and every one was being treated
 * as a matn: made clickable as "نص الحديث", and checked against the retrieved
 * passages, where a title that happens not to appear verbatim was flagged
 * unverified. An amber warning on a book title tells the reader something
 * untrue about the answer.
 *
 * Distinguished by the word in front of it, which in practice is decisive: a
 * title follows «في» or «في كتابه», while a matn follows «حديث», «زيادة»,
 * «جملة» or a colon. The length cap guards the one way this could misfire — a
 * genuine matn introduced by «جاء في» — since titles are short and matns rarely
 * are.
 *
 * Scholars' verdicts («روي بإسنادين فيهما ضعيف») are deliberately *not*
 * excluded: those are real quotations from the retrieved pages, so checking
 * them against those pages is exactly right.
 */
const TITLE_LEAD = /(?:في|كتابه?|كتابها|مصنفه?|ضمن)\s+$/u;
const TITLE_MAX = 60;

const isTitleReference = (quote: string, before: string) =>
  quote.startsWith("«") &&
  quote.length - 2 <= TITLE_MAX &&
  TITLE_LEAD.test(before);

/**
 * Window slid across the whole quote. Checking only the opening words is not
 * enough — the reported corruption (`عَوْمَل` for `عَمَل`) sits thirteen words
 * in, so a quote that begins correctly and degrades later would pass.
 */
const WINDOW = 4;

export const isQuoteSupported = (quote: string, haystack: string): boolean => {
  const words = normaliseArabic(quote.replace(/^[﴿«]|[﴾»]$/g, ""))
    .split(" ")
    .filter(Boolean);
  if (words.length < 3) return true; // too short to judge; do not cry wolf
  if (words.length <= WINDOW) return haystack.includes(words.join(" "));

  // every window must appear: one altered word breaks the windows spanning it,
  // which is exactly the failure being guarded against
  for (let i = 0; i + WINDOW <= words.length; i++) {
    if (!haystack.includes(words.slice(i, i + WINDOW).join(" "))) return false;
  }
  return true;
};

/**
 * Wraps unsupported quotations in `<unverified>` for the renderer to mark.
 * Returns the text unchanged when there are no sources to check against, so an
 * answer is never flagged simply because its evidence was not captured.
 */
/**
 * Wraps every Qurʾānic and hadith quotation in `<scripture>` so the renderer
 * can make it openable.
 *
 * Applied to all of them, not only the verified ones: an unverified quote is
 * the one a reader most needs to inspect, so excluding it would remove the
 * affordance exactly where it matters. The `kind` attribute distinguishes the
 * two by their delimiter — ﴿ ﴾ is Qurʾān, « » is a hadith matn — and, where the
 * delimiter is wrong, by the script: see `UTHMANI` below.
 *
 * Runs before markUnverifiedQuotes so the two marks nest rather than collide.
 */
/**
 * Characters ʿUthmānī orthography uses and the standard script does not.
 *
 * The delimiter alone cannot decide the kind. «…» is the hadith's, but the
 * غريب القرآن section quotes **Qurʾānic words** in it — «ٱلۡقَيُّومُ»، «سِنَةٞ»،
 * «كُرۡسِيُّهُ» — because that is how the centre's data writes a headword. Every
 * one of those was being marked as a matn: set in the hadith face, and, once
 * quotations became openable, offering to show a reader «أحكام المحدّثين» for a
 * word of آية الكرسي.
 *
 * The script settles it, because the two corpora are written in different ones.
 * Measured across every passage this app has retrieved: 73 of 73 Qurʾānic
 * passages carry at least one of these, and 0 of 33 hadith passages do. Alef
 * wasla, superscript alef, the Qurʾānic annotation signs and the open tanwin
 * forms are ʿUthmānī conventions; the hadith encyclopedias vocalise in standard
 * tashkīl, which shares none of them.
 */
const UTHMANI_MARKS = new Set([
  0x065c, // ARABIC VOWEL SIGN DOT BELOW
  0x065e, // ARABIC FATHA WITH TWO DOTS — the open fatḥatān
  0x0670, // ARABIC LETTER SUPERSCRIPT ALEF
  0x0671, // ARABIC LETTER ALEF WASLA
]);

/* read codepoint by codepoint rather than as a character class: a class of
   combining marks is ambiguous enough that the linter refuses it, and this says
   plainly what it is looking for */
const inUthmaniScript = (text: string) =>
  [...text].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return (
      UTHMANI_MARKS.has(code) ||
      (code >= 0x06d6 && code <= 0x06ed) || // Qurʾānic annotation signs
      (code >= 0x08f0 && code <= 0x08f2) // the open tanwīn forms
    );
  });

export const markScriptureQuotes = (text: string): string =>
  text.replace(QUOTE, (quote: string, _group: string, offset: number) => {
    if (isTitleReference(quote, text.slice(0, offset))) return quote;
    const kind =
      quote.startsWith("﴿") || inUthmaniScript(quote) ? "quran" : "hadith";
    return `<scripture kind="${kind}">${quote}</scripture>`;
  });

export const markUnverifiedQuotes = (
  text: string,
  haystack: string,
): string => {
  if (!haystack) return text;
  return text.replace(QUOTE, (quote: string, _group: string, offset: number) =>
    // a book's title is a reference, not a quotation: there is nothing to check
    // it against, and flagging it says something untrue about the answer
    isTitleReference(quote, text.slice(0, offset)) ||
    isQuoteSupported(quote, haystack)
      ? quote
      : `<unverified>${quote}</unverified>`,
  );
};
