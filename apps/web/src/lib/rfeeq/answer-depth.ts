/**
 * How much detail the reader wants in an answer.
 *
 * A preference, not a quality setting: every level is fully sourced and fully
 * attributed, and none of them licenses a shorter answer to drop a citation or
 * a hadith's grading. What changes is how much of the surrounding material is
 * brought forward — which is the brief's الجودة الدعوية criterion read
 * literally: «تراعى خلفية المخاطَب، ومستواه … دون اختزال مخل».
 */
export type AnswerDepth = "short" | "standard" | "detailed";

export const ANSWER_DEPTHS: { value: AnswerDepth; label: string }[] = [
  { value: "short", label: "مختصرة" },
  { value: "standard", label: "متوسطة" },
  { value: "detailed", label: "مفصّلة" },
];

export const DEFAULT_ANSWER_DEPTH: AnswerDepth = "standard";

/**
 * The instruction appended to the system prompt for each level.
 *
 * Written as constraints on *scope* rather than on length, because a word
 * count is the one instruction a model will meet by truncating a ruling
 * mid-sentence. Each one restates that the citation and grading rules are
 * unaffected, since those are exactly what a "be brief" instruction tends to
 * erode.
 */
const INSTRUCTIONS: Record<AnswerDepth, string> = {
  short: `<answer_depth>
The reader has asked for short answers. Give the ruling or the finding first
and stop there: one or two short paragraphs, the single strongest piece of
evidence, no survey of secondary positions.

This narrows what you cover. It does not relax any other rule. Every claim
still carries its citation, every hadith still carries its source and its
grading, and a disagreement is still reported as a disagreement rather than
resolved. If the material cannot be stated honestly in short form, say so and
give what it does take.
</answer_depth>`,
  standard: `<answer_depth>
The reader has asked for answers of ordinary length: the ruling or finding,
its evidence, and the context needed to use it correctly, without an
exhaustive survey.
</answer_depth>`,
  detailed: `<answer_depth>
The reader has asked for detailed answers. Bring forward the supporting
material you would otherwise leave out: the full evidence, the positions of
each school with its own attribution, the conditions and exceptions, and the
wording of the sources where it matters.

Detail is not licence to go beyond the retrieved material. Anything you add
must still be traceable to a source; where the sources are silent, say they
are silent rather than filling the space.
</answer_depth>`,
};

/** Appends the depth instruction to a composed system prompt. */
export const withAnswerDepth = (
  prompt: string,
  depth: AnswerDepth | undefined,
) =>
  depth && depth !== "standard"
    ? `${prompt}\n\n${INSTRUCTIONS[depth]}`
    : prompt;
