/**
 * The name a saved conversation wears in the rail.
 *
 * The stored title is the opening question verbatim — `deriveTitle` in
 * `lib/chat-history.ts` takes the first 120 characters of it — and that is the
 * right thing to *store*: history search matches against it, and a question is
 * what the reader actually wrote. It is the wrong thing to *show*.
 *
 * Arabic questions in this domain share a long opening stem, and the rail shows
 * roughly 22 characters. «ما تفسير الآية 43 من سورة النحل؟» spends 24 of them
 * before reaching the one word that distinguishes it from every other verse
 * question, so a rail of them reads:
 *
 *     ما تفسير الآية 43 من سور…
 *     ما تفسير الآية 43 من سور…
 *     ما تفسير الآية 43 من سور…
 *
 * Twelve rows, one legible name. The row is not too narrow — widening it just
 * moves the cut — the title is simply front-loaded with the part every sibling
 * shares. So the fix is to put the distinguishing part first.
 *
 * Deliberately rules rather than a model. A title is written once and read
 * every time the rail opens; it must be instant, free, identical across
 * reloads, and never invent a subject the conversation did not have. The
 * question shapes here are regular enough that rules reach them, and every rule
 * is **conservative**: text that matches nothing comes back untouched, so a
 * conversation the reader renamed by hand is shown exactly as they named it.
 */

/** ٠-٩ for 0-9, so a number never flips direction mid-line. */
const arabicDigits = (text: string) =>
  text.replace(/\d/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)] ?? digit);

/**
 * Patterns are written against the **raw** title, not a normalised one.
 *
 * `normalise` in `intent.ts` exists for routing, where folding ة→ه and آ→ا is
 * what makes a term matchable. Here the output is read by a person, so the text
 * keeps its spelling and the patterns absorb the variation instead.
 */
const ALEF = "[آاأ]";
const TA = "[ةه]";
const NUMBER = "[\\d٠-٩]+(?:\\s*[-–]\\s*[\\d٠-٩]+)?";

/**
 * «الآية 43 من سورة النحل» → «النحل 43».
 *
 * The rule that earns most of the space. It moves the sūra name from the 24th
 * character to the 1st, which is the difference between twelve identical rows
 * and twelve distinct ones, and it loses nothing: a verse is named by its sūra
 * and number in every reference convention there is.
 */
const AYAH = new RegExp(
  `(?:ال)?${ALEF}ي(?:${TA}|ات)\\s*(${NUMBER})\\s*من\\s*سور${TA}\\s*([^\\s؟?,.]+)`,
  "u",
);

/**
 * «حديث «اطلبوا العلم ولو بالصين»» → ««اطلبوا العلم ولو بالصين»».
 *
 * The word حديث is carried by the row's icon, so spending six characters of a
 * twenty-two character row repeating it costs six characters of the matn — and
 * the matn is the only part that tells two hadith questions apart.
 */
const HADITH = /حديث\s*(?=[«"'])/u;

/**
 * A leading «ما» / «ما هو» / «ماذا», and nothing else.
 *
 * Dropping it leaves a noun phrase that still reads: «ما تفسير…» → «تفسير…»,
 * «ما هو دعاء السوق» → «دعاء السوق». The other interrogatives are left alone on
 * purpose — «هل» and «كيف» are two or three characters, and removing them turns
 * a question into a fragment that reads as an assertion. «هل يجوز الجمع» is
 * already short; it was never the problem.
 */
const OPENER = new RegExp(`^(?:ماذا|ما)\\s*(?:هو|هي)?\\s+`, "u");

/** A trailing «؟», which every row would otherwise end in. */
const MARK = /\s*[؟?]\s*$/u;

/**
 * Condenses a stored title for display. Never lengthens it, never truncates it
 * — the row's `truncate` does that, and it knows the real width.
 */
export const conversationTitle = (raw: string | null | undefined): string => {
  const text = (raw ?? "").trim();
  if (!text) return "محادثة";

  const condensed = text
    .replace(OPENER, "")
    .replace(AYAH, "$2 $1")
    .replace(HADITH, "")
    .replace(MARK, "")
    .replace(/\s+/g, " ")
    .trim();

  return arabicDigits(condensed) || text;
};
