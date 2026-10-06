import {
  CURATED,
  MAX_STARTERS,
  parseStarters,
  pickStarters,
} from "@/lib/rfeeq/starters";
import { routeQuestion, INTENT_ICON } from "@/lib/rfeeq/intent";
import { describe, expect, it } from "vitest";

/**
 * The opening chips are written now rather than fixed, and the whole point of
 * the guards is that the *chip* stays identical whatever the model writes:
 * three of them, each a short label beside the icon of the corpus its question
 * will actually reach.
 */
describe("writing the opening suggestions", () => {
  it("reads a label and a question from each line", () => {
    const parsed = parseStarters(
      "اشرح الآية | ما تفسير الآية 43 من سورة النحل؟\n" +
        "تحقّق من الحديث | ما صحة حديث «اطلبوا العلم ولو بالصين»؟",
    );
    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.label).toBe("اشرح الآية");
    expect(parsed[0]?.question).toContain("سورة النحل");
  });

  it.each([
    ["1. اشرح الآية | ما تفسير الآية 43 من سورة النحل؟"],
    ["- اشرح الآية | ما تفسير الآية 43 من سورة النحل؟"],
    ["• اشرح الآية | ما تفسير الآية 43 من سورة النحل؟"],
  ])("strips a bullet the model slipped in: %s", (line) => {
    expect(parseStarters(line)[0]?.label).toBe("اشرح الآية");
  });

  /*
   * The icon is never the model's. A chip carrying the muṣḥaf mark over a fiqh
   * question would be lying before it was pressed.
   */
  it("takes the icon from the router, not the line", () => {
    const parsed = parseStarters(
      "سؤال فقهي | ما أحكام الجمع والقصر في السفر؟\n" +
        "آية | ما تفسير الآية 43 من سورة النحل؟",
    );
    expect(parsed[0]?.icon).toBe(INTENT_ICON[routeQuestion(parsed[0]!.question).intent]);
    expect(parsed[1]?.icon).toBe("quran");
    expect(parsed[0]?.icon).not.toBe("quran");
  });

  /* The row is three chips wide; a long label wraps it. */
  it("drops an overlong label rather than truncating it", () => {
    const long = "عنوان طويل جدًّا لا يصلح أن يُكتب على زرّ في صفّ من ثلاثة أزرار";
    expect(parseStarters(`${long} | ما أحكام الجمع والقصر في السفر؟`)).toEqual(
      [],
    );
  });

  it.each([
    "حالتي | أنا مسافر غدًا، هل أقصر الصلاة؟",
    "حكم على شخص | هل جارنا هذا كافر؟",
  ])("drops a suggestion the system would have to refuse: %s", (line) => {
    expect(parseStarters(line)).toEqual([]);
  });

  it("drops a line with no question behind the label", () => {
    expect(parseStarters("اشرح الآية")).toEqual([]);
    expect(parseStarters("اشرح الآية | ")).toEqual([]);
  });
});

describe("picking the three", () => {
  const starter = (label: string, question: string) =>
    parseStarters(`${label} | ${question}`)[0]!;

  const quran = starter("آية", "ما تفسير الآية 43 من سورة النحل؟");
  const quran2 = starter("آية أخرى", "ما تفسير الآية 255 من سورة البقرة؟");
  const hadith = starter("حديث", "ما صحة حديث «إنما الأعمال بالنيات»؟");
  const fiqh = starter("فقه", "ما أحكام الجمع والقصر في السفر؟");

  /*
   * The trio exists to show that a verse, a report and a ruling are handled
   * differently, so three Qurʾānic suggestions would be a worse row than three
   * unrelated ones.
   */
  it("prefers one corpus each", () => {
    const picked = pickStarters([quran, quran2, hadith, fiqh]);
    expect(picked).toHaveLength(MAX_STARTERS);
    expect(new Set(picked.map((s) => s.icon)).size).toBe(3);
  });

  it("always returns three, filling from the curated set", () => {
    expect(pickStarters([quran])).toHaveLength(MAX_STARTERS);
    expect(pickStarters([])).toEqual(CURATED);
  });

  it("does not repeat a curated question it already picked", () => {
    const picked = pickStarters([CURATED[0]!]);
    const questions = picked.map((s) => s.question);
    expect(new Set(questions).size).toBe(questions.length);
  });
});

/*
 * The fallback is shown instantly and stays if generation fails, so it has to
 * be a set this system answers *well* — not a placeholder.
 */
describe("the curated trio", () => {
  it("is three, one per corpus", () => {
    expect(CURATED).toHaveLength(MAX_STARTERS);
    expect(new Set(CURATED.map((s) => s.icon)).size).toBe(3);
  });

  it("carries the icon its question actually routes to", () => {
    for (const starter of CURATED) {
      expect(starter.icon).toBe(
        INTENT_ICON[routeQuestion(starter.question).intent],
      );
    }
  });

  it("asks nothing the system would have to refuse", () => {
    for (const starter of CURATED) {
      expect(routeQuestion(starter.question).exclusion).toBeNull();
    }
  });
});
