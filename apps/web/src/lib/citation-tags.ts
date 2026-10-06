/**
 * Normalises the citation tags a model emits before anything tries to read them.
 *
 * The contract is `<citation ids="a,b" />`, and it is followed about 96% of the
 * time. The rest are near misses that cost the reader a real citation:
 *
 *   <citation ids="a,b">        — opening tag, no self-closing slash
 *   <citation id="a" />         — the attribute in the singular
 *   <citation ids="a,b>         — the closing quote never arrives
 *   <citation needs="a,b" />    — an invented attribute name
 *
 * Every one of these carries perfectly good chunk ids; only the syntax is
 * wrong. Left alone they render as "Unknown citation", and worse, the paragraph
 * around them gets flagged as uncited — the answer *is* sourced, but
 * unparseably so. Repairing the tag is therefore not cosmetic: it decides
 * whether a cited claim reads as cited.
 *
 * Deliberately a repair rather than a stricter instruction. The prompt already
 * specifies the format; a rule the model must remember mid-sentence, thousands
 * of tokens into an answer, is a preference. This is the same reasoning that
 * put retrieval behind `toolChoice` and the answer language behind a gate.
 */

/** `ids`, `id`, and the invented `needs` all mean the same thing. */
const ATTR = "(?:ids|id|needs)";

/**
 * Normalised to an explicitly closed element, never to a self-closing one.
 *
 * This is the part that is not obvious. HTML5 ignores the self-closing slash on
 * an unknown element, so `<citation ids="a" />` is an *opening* tag however it
 * is written — and everything after it becomes its children rather than its
 * sibling. One tag per paragraph hides this, because the renderer puts the
 * children back after the marker. Several in a row do not: each nests inside
 * the last, the punctuation between them is swallowed, and the ids surface as
 * text in the middle of the answer.
 *
 * `<citation ids="a"></citation>` closes it where it stands, so the sentence
 * after it stays part of the sentence.
 */
const closed = (ids: string) => `<citation ids="${ids}"></citation>`;

export const repairCitationTags = (text: string): string =>
  text
    /*
     * Content between the tags, which the model sometimes writes when it closes
     * the element itself — `<citation ids="a">.</citation>`, the sentence's full
     * stop having wandered inside. The text is kept and moved *after* the
     * closed element, because it is the answer's prose and belongs in the
     * sentence, not in a citation marker.
     *
     * First, because the general rule below would consume the opening tag and
     * leave the stray `</citation>` behind as literal text.
     */
    .replace(
      new RegExp(
        `<citation\\s+${ATTR}\\s*=\\s*"([^"]*)"\\s*>([^<]*)</citation>`,
        "g",
      ),
      (_, ids: string, trailing: string) => closed(ids) + trailing,
    )
    // quoted value present: normalise the attribute name and close the tag,
    // absorbing a closing tag the model already wrote so it is not doubled
    .replace(
      new RegExp(
        `<citation\\s+${ATTR}\\s*=\\s*"([^"]*)"\\s*/?>(?:\\s*</citation>)?`,
        "g",
      ),
      (_, ids: string) => closed(ids),
    )
    // no closing quote: the value runs to the ">" that ended the tag. Chunk ids
    // never contain ">", so the boundary is unambiguous.
    .replace(
      new RegExp(`<citation\\s+${ATTR}\\s*=\\s*"([^">]*)>`, "g"),
      (_, ids: string) => closed(ids.trim()),
    );
