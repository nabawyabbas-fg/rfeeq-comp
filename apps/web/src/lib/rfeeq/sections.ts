import type { RfeeqTemplate } from "./intent";
import type { SectionSpec } from "./templates";

import { sectionsFor } from "./templates";

/**
 * Reading the section markers an answer was asked to emit.
 *
 * The contract is `<part k="key">…</part>`, and like the citation contract it
 * will be followed most of the time and missed in a handful of predictable
 * ways. Those misses are repaired here rather than prevented by a sterner
 * instruction, for the same reason the citation tags are: the prompt already
 * specifies the format, and a rule the model must hold onto several thousand
 * tokens into an answer is a preference, not a guarantee.
 *
 * What this tolerates:
 *
 *   <part k=gharib>            — the value unquoted
 *   <part key="gharib">        — the attribute under another name
 *   <part k="gharib"           — never closed; content runs to the next marker
 *   <part k="ghareeb">         — a key no template declares
 *   sections out of order      — reordered to the template's order, which is
 *                                the one the specification fixes
 *
 * The one rule it never breaks is that **no text is lost**. A section the
 * template does not declare, or prose written before the first marker, still
 * reaches the reader — as unlabelled body text above the stack. Dropping it
 * would turn a formatting slip into a missing answer, which is far worse than
 * an answer whose shape is imperfect.
 */

/** One section as the model emitted it, resolved against the template. */
export interface RenderSection extends SectionSpec {
  /** The prose the model wrote, for a `prose` section. */
  body: string;
  /** The chunk id the model named, for a structural section. */
  ref: string | null;
  /**
   * The marker's raw attribute text.
   *
   * Carried rather than parsed into named fields because the fields a section
   * wants are the section's own business: the evidence table reads `issue` to
   * head itself, and whatever comes next will want something else. Read it with
   * `sectionAttr`.
   */
  attrs: string;
}

export interface AnswerSections {
  /** The sections to render, in the template's order. */
  ordered: RenderSection[];
  /**
   * Text that belonged to no declared section.
   *
   * Rendered above the stack as plain body. Non-empty here is a signal worth
   * watching: it means the model wrote outside the contract.
   */
  loose: string;
  /** Whether any marker was found. False means render the whole text as prose. */
  tagged: boolean;
}

/* `/?` because a model that writes `<part k="x" />` means an empty section. */
const OPEN = /<part\b([^>]*?)\/?>/gi;
const CLOSE = /<\/part\s*>/i;

/** `k`, `key` and `name` all mean the key; the value may be unquoted. */
export const attr = (attrs: string, names: string[]) => {
  for (const name of names) {
    const quoted = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i").exec(attrs);
    if (quoted?.[1] !== undefined) return quoted[1].trim();
    const bare = new RegExp(`\\b${name}\\s*=\\s*([^\\s"'>]+)`, "i").exec(attrs);
    if (bare?.[1] !== undefined) return bare[1].trim();
  }
  return null;
};

/** Reads one of a section marker's own attributes, e.g. the evidence `issue`. */
export const sectionAttr = (section: RenderSection, names: string[]) =>
  attr(section.attrs, names);

/**
 * Splits a marked answer into its template's sections.
 *
 * Takes the text *after* the marking passes have run, so the citation,
 * scripture and verification marks inside each section survive the split. That
 * ordering matters and is not interchangeable: those passes read whole
 * paragraphs, and splitting first would hand them fragments.
 */
export const answerSections = (
  raw: string,
  template: RfeeqTemplate,
): AnswerSections => {
  const specs = sectionsFor(template);

  /*
   * A tag still arriving is not a tag.
   *
   * These sections render while the answer streams, so the tail of the text is
   * routinely a half-written marker — `<part k="rul`. The scanner needs a `>`
   * to recognise one, so without this the fragment would render as literal
   * text for a few hundred milliseconds and then vanish. Cutting any
   * unterminated tag off the end is both the fix and, for a completed answer,
   * a no-op.
   */
  const text = raw.replace(/<[a-z]*(?:\s[^>]*)?$/i, "");

  const opens: { end: number; start: number; attrs: string }[] = [];
  OPEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = OPEN.exec(text)) !== null) {
    opens.push({
      start: match.index,
      end: match.index + match[0].length,
      attrs: match[1] ?? "",
    });
  }

  if (opens.length === 0) {
    return { ordered: [], loose: text, tagged: false };
  }

  // prose before the first marker is the model writing outside the contract
  const looseParts = [text.slice(0, opens[0]!.start)];
  /* Several emissions of one key are concatenated rather than the last
     winning: a model that splits غريب القرآن over two markers has written one
     section in two pieces, and keeping only the second would silently drop
     half of it. */
  const bodies = new Map<string, string[]>();
  const refs = new Map<string, string>();
  const attrsFor = new Map<string, string>();

  opens.forEach((open, index) => {
    const until = opens[index + 1]?.start ?? text.length;
    const slice = text.slice(open.end, until);
    const close = CLOSE.exec(slice);
    const body = (close ? slice.slice(0, close.index) : slice).trim();

    const key = attr(open.attrs, ["k", "key", "name"]);
    const spec = key ? specs.find((item) => item.key === key) : null;

    if (!spec) {
      // an undeclared key: keep the words, lose only the structure
      if (body) looseParts.push(body);
      return;
    }

    if (body) bodies.set(spec.key, [...(bodies.get(spec.key) ?? []), body]);
    const ref = attr(open.attrs, ["ref", "id", "chunk"]);
    if (ref && !refs.has(spec.key)) refs.set(spec.key, ref);
    // the first marker's attributes win, as its ref does
    if (!attrsFor.has(spec.key)) attrsFor.set(spec.key, open.attrs);
  });

  /*
   * Ordered by the template, not by the model.
   *
   * The specification fixes the order — the fiqh ruling before its detail, the
   * verse before its commentary — so a model that emits them the other way
   * round has made a mistake the renderer can simply correct.
   */
  const ordered = specs.flatMap<RenderSection>((spec) => {
    const body = (bodies.get(spec.key) ?? []).join("\n\n");
    const ref = refs.get(spec.key) ?? null;
    /* An omitted section is omitted on purpose: the format instruction tells
       the model to drop a section it has no material for rather than fill it
       with an apology. A structural section still renders on a ref alone. */
    if (!body && !ref) return [];
    return [{ ...spec, body, ref, attrs: attrsFor.get(spec.key) ?? "" }];
  });

  return {
    ordered,
    loose: looseParts.join("\n\n").trim(),
    tagged: true,
  };
};
