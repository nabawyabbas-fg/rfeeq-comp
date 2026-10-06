import { generateFollowUps, MAX_FOLLOW_UPS } from "@/lib/rfeeq/follow-ups";
import { afterEach, describe, expect, it, vi } from "vitest";

const respondWith = (text: string) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            output: [
              { type: "message", content: [{ type: "output_text", text }] },
            ],
          }),
      } as Response),
    ),
  );

afterEach(() => vi.unstubAllGlobals());

describe("follow-up suggestions", () => {
  it("returns at most four", async () => {
    respondWith(
      [
        "ما سبب نزول آية النحل 43؟",
        "من هم أهل الذكر في الآية؟",
        "ما فوائد الآية العملية؟",
        "ما أقوال المفسرين في معنى الذكر؟",
        "سؤال خامس زائد عن الحد؟",
        "سؤال سادس زائد؟",
      ].join("\n"),
    );

    const questions = await generateFollowUps("س", "ج", "key");
    expect(questions).toHaveLength(MAX_FOLLOW_UPS);
    expect(questions).not.toContain("سؤال خامس زائد عن الحد؟");
  });

  /*
   * A suggestion is a button the reader will press. Offering a personal-case
   * question walks them into the one thing the system must not do, and would
   * be answered with a referral — a poor use of a suggestion. The instructions
   * ask for this; the filter makes it certain.
   */
  it("drops a suggestion that asks about the reader's own case", async () => {
    respondWith(
      [
        "ما شروط الجمع بين الصلاتين في السفر؟",
        "أنا مسافر غدًا، هل أقصر الصلاة؟",
        "نسيت التشهد في صلاتي، ماذا أفعل؟",
        "ما الأدلة من السنة على الجمع؟",
      ].join("\n"),
    );

    const questions = await generateFollowUps("س", "ج", "key");
    expect(questions).toEqual([
      "ما شروط الجمع بين الصلاتين في السفر؟",
      "ما الأدلة من السنة على الجمع؟",
    ]);
  });

  it("strips bullets and numbering the model adds", async () => {
    respondWith(
      "- ما سبب نزول الآية؟\n2) ما فوائدها العملية؟\n• ما معنى الذكر؟",
    );
    await expect(generateFollowUps("س", "ج", "key")).resolves.toEqual([
      "ما سبب نزول الآية؟",
      "ما فوائدها العملية؟",
      "ما معنى الذكر؟",
    ]);
  });

  it("returns nothing rather than failing when the call errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("down"))),
    );
    // a missing suggestion is a missing convenience; the answer is unaffected
    await expect(generateFollowUps("س", "ج", "key")).resolves.toEqual([]);
  });

  it("does not call out without an answer to suggest from", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(generateFollowUps("س", "   ", "key")).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
