import {
  answerEditionsFor,
  tafsirEditionsFor,
  TAFSIR_EDITIONS,
} from "@/lib/rfeeq/expertise";
import { describe, expect, it } from "vitest";

/**
 * What the answer is written from is not what the pane lists.
 *
 * A non-specialist was getting both التفسير الميسر and المختصر woven into every
 * commentary answer, so each point arrived twice — «(التفسير الميسر)» and
 * «(المختصر في التفسير)» on the same sentence, the same meaning in two
 * wordings. «المعنى الإجمالي» is one meaning.
 */
describe("the general reader", () => {
  it("is answered from one edition", () => {
    expect(answerEditionsFor("general")).toEqual(["moyassar"]);
  });

  /* dropped from the answer, not from the reader's reach */
  it("still sees the other in the āya pane", () => {
    expect(tafsirEditionsFor("general")).toContain("mukhtasar_ar");
    expect(tafsirEditionsFor("general")).toContain("moyassar");
  });

  it("gets the same treatment when no level was chosen", () => {
    expect(answerEditionsFor(undefined)).toEqual(["moyassar"]);
  });
});

/**
 * The specialist list is untouched. Four classical commentaries side by side is
 * the point of that level — «اذكر مواضع الخلاف وأسبابه، ومن قال بكل قول» —
 * and narrowing it to one would remove the axis rather than tidy it.
 */
describe("the specialist", () => {
  it("is still answered from all four", () => {
    expect(answerEditionsFor("specialist")).toEqual(
      TAFSIR_EDITIONS.specialist,
    );
    expect(answerEditionsFor("specialist")).toHaveLength(4);
  });

  it("reads a set that shares nothing with the general reader's", () => {
    const general = new Set(tafsirEditionsFor("general"));
    for (const edition of tafsirEditionsFor("specialist")) {
      expect(general.has(edition), `${edition} is in both sets`).toBe(false);
    }
  });
});
