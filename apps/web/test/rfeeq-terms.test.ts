import { termGuards, termsIn } from "@/lib/rfeeq/terms";
import { describe, expect, it } from "vitest";

/**
 * The brief's page 7 is ten terms each carrying a ضابط استخدام, and most of
 * those controls forbid one specific plausible rendering. The prompt could say
 * "prefer the dictionary"; it could not carry ten prohibitions readably. So the
 * control is injected per question — and these tests are about *which* control
 * arrives, since a rule for the wrong term is worse than none.
 */
describe("the approved terminology dictionary", () => {
  it.each([
    ["ما معنى التوحيد؟", "التوحيد"],
    ["هل الشريعة هي القانون الجنائي؟", "الشريعة"],
    ["ما الفرق بين الفتوى والمعلومة العامة؟", "الفتوى"],
    ["ما معنى الدعوة إلى الله؟", "الدعوة"],
    ["ما هي العبادة في الإسلام؟", "العبادة"],
  ])("detects the term in %s", (question, term) => {
    expect(termsIn(question).map((t) => t.term)).toContain(term);
  });

  it("injects the headword, the equivalent and the control", () => {
    const block = termGuards("ما معنى التوحيد بالإنجليزية؟");
    expect(block).toContain("التوحيد");
    expect(block).toContain("Tawhid");
    // the prohibition is the part a fluent model gets wrong on its own
    expect(block).toContain("الوحدانية العددية");
    expect(block).toContain("<approved_terminology>");
    // the headword is interpolated from the term, not the object holding it
    expect(block).not.toContain("[object Object]");
  });

  it("carries nothing for a question that touches none of the ten", () => {
    expect(termGuards("ما سبب نزول سورة الفيل؟")).toBe("");
    expect(termsIn("ما سبب نزول سورة الفيل؟")).toEqual([]);
  });

  /*
   * A dictionary lookup wants the headword, not every word containing it: the
   * plural «العبادات» is a different entry, and «السنين» is not «السنة» at all.
   * The topical patterns in `intent.ts` deliberately do the opposite, which is
   * why these matchers are separate.
   */
  it("matches the headword and not words that merely contain it", () => {
    expect(termsIn("كم عدد السنين بين الهجرة والفتح؟")).toEqual([]);
    expect(termsIn("ما حكم الصلاة؟")).toEqual([]);
  });

  it("matches across the clitic prefixes Arabic attaches", () => {
    expect(termsIn("وبالسنة نعرف هدي النبي").map((t) => t.term)).toContain(
      "السنة",
    );
  });

  /*
   * A question can touch several — «ما الفرق بين السنة والحديث؟» hits two — but
   * a prompt carrying six prohibitions has stopped constraining anything.
   */
  it("caps how many controls one turn carries", () => {
    const many = termsIn(
      "ما الفرق بين السنة والحديث والفتوى والشريعة والعبادة والدعوة؟",
    );
    expect(many.length).toBeLessThanOrEqual(3);
    expect(many.length).toBeGreaterThan(1);
  });
});

/**
 * The brief's case 12 is «سؤال بلغة غير عربية يتضمن مصطلحًا دينيًا ذا دلالة
 * ثقافية خاصة» — and matching Arabic stems alone meant the control never fired
 * on the one case the dictionary exists for. Found by running the twelve.
 */
describe("a question that is not in Arabic", () => {
  it.each([
    ["What does Sharia actually mean?", "الشريعة"],
    ["Is shariah law just a penal code?", "الشريعة"],
    ["What is tawheed in Islam?", "التوحيد"],
    ["Who can issue a fatwa?", "الفتوى"],
    ["What is the difference between hadith and sunnah?", "الحديث"],
  ])("detects the term in %s", (question, term) => {
    expect(termsIn(question).map((t) => t.term)).toContain(term);
  });

  it("carries the control into an English turn", () => {
    const block = termGuards("Is Sharia just Islamic criminal law?");
    expect(block).toContain("Sharia / Islamic law and guidance");
    // the prohibition the brief attaches to this term
    expect(block).toContain("العقوبات");
  });

  /*
   * Latin word boundaries, so a term is not found inside an unrelated word.
   */
  it("does not fire on a word that merely contains one", () => {
    expect(termsIn("What is islamophobia?").map((t) => t.term)).not.toContain(
      "الإسلام",
    );
    expect(termsIn("He is a sunnah-adjacent writer")).toBeTruthy();
  });
});
