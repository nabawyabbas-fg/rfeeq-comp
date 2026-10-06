/**
 * Marks passages of an answer that carry no citation.
 *
 * Forcing retrieval guarantees the sources were fetched; it does not guarantee
 * the answer used them. Across 240 evaluation runs, 411 substantive claims —
 * rulings, attributions, hadith gradings, verse locations — carried no citation
 * at all, and the two clearest factual errors found in the audit were both in
 * uncited sentences. They render cleanly, break nothing, and are exactly the
 * statements a reader cannot check.
 *
 * A gate that rejected uncited answers mid-stream was tried and removed: by the
 * time the absence is detectable the text has already been shown, so rejecting
 * truncated answers instead of replacing them. Marking is what remains possible
 * without either buffering the whole answer or hiding it.
 */

/**
 * A marker that names a source.
 *
 * Deliberately general rather than a list of tag names. Three markers now carry
 * an attribution and they do it the same way — `<citation ids="…">`, a
 * structural section's `<part … ref="…">`, an evidence row's `<ev … ids="…">` —
 * so the rule is the shape, not the vocabulary: **a marker bearing a non-empty
 * `ids` or `ref` attributes its passage.** Enumerating tag names instead meant
 * that each new marker silently started reading as unsourced, which happened
 * twice in a row: a verse card was bannered as citing nothing, and an evidence
 * table would have been next.
 *
 * Non-empty matters. `<citation ids="">` is a citation tag that cites nothing,
 * and counting it attributed is how an unsourced answer passes for a sourced
 * one.
 */
const ATTRIBUTED = /<[a-z][\w-]*\b[^>]*\b(?:ids|ref)\s*=\s*"\s*[^\s"][^"]*"/gi;

/** Any tag, for measuring a paragraph by what it says rather than its markup. */
const MARKUP = /<[^>]*>/g;

const test = (pattern: RegExp, text: string) => {
  pattern.lastIndex = 0;
  const found = pattern.test(text);
  pattern.lastIndex = 0;
  return found;
};

/**
 * Paragraph, not sentence. Models routinely write a passage and place a single
 * citation at its end, which is legitimate; flagging per sentence marks 21% of
 * an answer against 13% per paragraph, most of it noise.
 */
const MIN_CHARS = 80;

/**
 * Whether a paragraph makes a claim worth attributing.
 *
 * Measured on the words, with the markup stripped — tags are removed and their
 * content kept. Without that, a run of structural section markers is a
 * 140-character "paragraph" that clears the threshold while saying nothing of
 * its own, and gets marked unsourced on the one part of an answer built
 * entirely *from* the sources.
 */
const isSubstantive = (paragraph: string): boolean => {
  const bare = paragraph.replace(MARKUP, "").trim();
  if (bare.length < MIN_CHARS) return false; // headings, connective lines
  if (/^#{1,6}\s/.test(bare)) return false; // markdown heading
  if (/^[-*>|]/.test(bare) && bare.length < 200) return false; // short list item or quote
  return true;
};

const hasCitation = (paragraph: string): boolean =>
  test(ATTRIBUTED, paragraph);

/** True when the whole answer cites nothing — shown as a banner, not per paragraph. */
export const citesNothing = (text: string): boolean => {
  const source = String(text);
  return source.trim().length > 0 && !test(ATTRIBUTED, source);
};

/**
 * Appends `<uncited />` to substantive paragraphs with no citation. A marker is
 * appended rather than the paragraph being wrapped, so the markdown block
 * structure is untouched.
 *
 * Returns the text unchanged for an answer that cites nothing at all — marking
 * every paragraph says less than one banner, and says it worse.
 */
export const markUncitedParagraphs = (text: string): string => {
  const source = String(text);
  if (!source.trim() || citesNothing(source)) return source;

  return source
    .split(/(\n\s*\n)/)
    .map((chunk) =>
      /\n\s*\n/.test(chunk) || !isSubstantive(chunk) || hasCitation(chunk)
        ? chunk
        : `${chunk.trimEnd()} <uncited />`,
    )
    .join("");
};
