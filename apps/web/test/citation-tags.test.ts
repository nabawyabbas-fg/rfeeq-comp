import { repairCitationTags } from "@/lib/citation-tags";
import { describe, expect, it } from "vitest";

/**
 * The tags a model actually emits, and the one property that matters about the
 * repaired form: the element is explicitly closed.
 */
describe("repairCitationTags", () => {
  it.each([
    ['<citation ids="a,b" />', "the contract form"],
    ['<citation ids="a,b">', "no self-closing slash"],
    ['<citation id="a,b" />', "the attribute in the singular"],
    ['<citation needs="a,b" />', "an invented attribute name"],
    ['<citation ids="a,b>', "the closing quote never arrives"],
    ['<citation ids="a,b"></citation>', "already closed"],
  ])("normalises %s (%s)", (input) => {
    expect(repairCitationTags(input)).toBe('<citation ids="a,b"></citation>');
  });

  /*
   * The bug this exists to prevent.
   *
   * HTML5 ignores the self-closing slash on an unknown element, so
   * `<citation ids="a" />` is an *opening* tag however it is written and
   * everything after it becomes its children. One tag per paragraph hides it,
   * because the renderer puts the children back after the marker. Several in a
   * row do not: each nests inside the last, the punctuation between them is
   * swallowed, and the ids surface as text in the middle of the answer — which
   * is exactly what a reader saw.
   */
  it("never emits a self-closing element", () => {
    const answer =
      'حكم عليه السخاوي بالضعف <citation ids="a#1">، وذكر ابن الجوزي ' +
      'أنه لا يصح <citation ids="b#1">، وقال البيهقي <citation ids="c#1,d#1">.';
    const repaired = repairCitationTags(answer);

    expect(repaired).not.toMatch(/\/>/);
    expect(repaired.match(/<\/citation>/g)).toHaveLength(3);
    // the punctuation between the tags survives as text rather than being
    // captured as a child of the tag before it
    expect(repaired).toContain("</citation>، وذكر ابن الجوزي");
  });

  it("leaves text with no citation tags alone", () => {
    const text = "نصٌّ فيه < و > ولا يحوي إحالات.";
    expect(repairCitationTags(text)).toBe(text);
  });

  it("keeps ids that contain # and -", () => {
    // the live web sources mint ids like `web-dorar-net-1u0qlvr#1`
    const input =
      '<citation ids="web-dorar-net-1u0qlvr#1,turath-10517#10517:858">';
    expect(repairCitationTags(input)).toBe(
      '<citation ids="web-dorar-net-1u0qlvr#1,turath-10517#10517:858"></citation>',
    );
  });

  /*
   * Seen in a live answer about ṭawāf al-wadāʿ: the model closed the element
   * itself and the sentence's full stop ended up inside it. The generic repair
   * consumed the opening tag and left `</citation>` behind as literal text in
   * the answer.
   */
  it("moves content out of a tag the model closed itself", () => {
    expect(repairCitationTags('نصٌّ <citation ids="a#1">.</citation> تابع')).toBe(
      'نصٌّ <citation ids="a#1"></citation>. تابع',
    );
  });

  it("leaves no orphan closing tag behind", () => {
    const out = repairCitationTags(
      'أ <citation ids="a#1">.</citation> ب <citation ids="b#2">، </citation> ج',
    );
    expect(out).not.toMatch(/^[^<]*<\/citation>/);
    expect(out.match(/<citation/g)).toHaveLength(2);
    expect(out.match(/<\/citation>/g)).toHaveLength(2);
  });
});
