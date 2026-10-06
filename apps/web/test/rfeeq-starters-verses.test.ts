import { parseStarters } from "@/lib/rfeeq/starters";
import {
  SURAHS,
  surahByName,
  verseReferences,
  versesExist,
} from "@/lib/rfeeq/quran-surahs";
import { describe, expect, it } from "vitest";

/**
 * The suggestion that sent a reader to a verse that does not exist.
 *
 * «ما تفسير الآية 25 من سورة الحجرات؟» — الحجرات has 18 āyāt. It reached the
 * first screen because nothing checked: the chip's label, length, icon and
 * scope were all validated, and the one claim it made about the Qurʾān was not.
 */
describe("the sūra table", () => {
  it("has all 114, in order, totalling 6236 āyāt", () => {
    expect(SURAHS).toHaveLength(114);
    expect(SURAHS.map((s) => s.number)).toEqual(
      Array.from({ length: 114 }, (_, i) => i + 1),
    );
    // مركز تفسير's own `get_quran_overview` figure
    expect(SURAHS.reduce((sum, s) => sum + s.ayahs, 0)).toBe(6236);
  });

  it("finds a sūra with or without its article, and by two words", () => {
    expect(surahByName("الحجرات")?.ayahs).toBe(18);
    expect(surahByName("حجرات")?.ayahs).toBe(18);
    expect(surahByName("آل عمران")?.ayahs).toBe(200);
    expect(surahByName("ال عمران")?.ayahs).toBe(200);
    expect(surahByName("الزهراء")).toBeNull();
  });
});

describe("a verse reference in a question", () => {
  it("rejects the one that was suggested", () => {
    expect(versesExist("ما تفسير الآية 25 من سورة الحجرات؟")).toBe(false);
  });

  it("accepts a real one, in either order and either numeral", () => {
    expect(versesExist("ما تفسير الآية 43 من سورة النحل؟")).toBe(true);
    expect(versesExist("ما تفسير الآية ٣٥ من سورة النور؟")).toBe(true);
    expect(versesExist("سورة البقرة، الآية 255 ما معناها؟")).toBe(true);
  });

  it("knows where a sūra ends", () => {
    expect(versesExist("ما تفسير الآية 200 من سورة آل عمران؟")).toBe(true);
    expect(versesExist("ما تفسير الآية 201 من سورة آل عمران؟")).toBe(false);
  });

  it("rejects a sūra that does not exist at all", () => {
    expect(versesExist("ما تفسير الآية 5 من سورة الزهراء؟")).toBe(false);
  });

  /*
   * The distinction that keeps this from rejecting everything: it asks whether
   * anything named here is wrong, not whether anything is named.
   */
  it("passes a question that names no verse", () => {
    expect(versesExist("ما أحكام الجمع والقصر في السفر؟")).toBe(true);
    expect(verseReferences("ما أحكام الجمع والقصر في السفر؟")).toHaveLength(0);
  });
});

describe("the generated opening suggestions", () => {
  it("drops a suggestion whose verse does not exist", () => {
    const parsed = parseStarters(
      [
        "اشرح الآية | ما تفسير الآية 25 من سورة الحجرات؟",
        "اشرح الآية | ما تفسير الآية 43 من سورة النحل؟",
      ].join("\n"),
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.question).toContain("النحل");
  });
});

/**
 * A hadith suggestion has to name the hadith.
 *
 * It offered «تحقّق من حديث عائشة» — عائشة narrated more than two thousand
 * reports, so there is nothing for the system to look up and nothing for the
 * reader to get. A hadith is identified by its matn.
 */
describe("a suggested hadith", () => {
  const parse = (question: string) =>
    parseStarters(`تحقّق من الحديث | ${question}`);

  it("is dropped when it names only the narrator", () => {
    expect(parse("ما صحة حديث عائشة رضي الله عنها؟")).toEqual([]);
    expect(parse("ما درجة حديث أبي هريرة؟")).toEqual([]);
  });

  it("is kept when it carries the matn", () => {
    const [kept] = parse("ما صحة حديث «إنما الأعمال بالنيات»؟");
    expect(kept?.icon).toBe("hadith");
  });

  /* short enough to be a turn of phrase, not a matn */
  it("is dropped when the quotation is too short to identify one", () => {
    expect(parse("ما صحة حديث «قال»؟")).toEqual([]);
  });

  /* the rule is the hadith intent's alone; a verse question has its own check */
  it("leaves a verse question to the verse rule", () => {
    const [kept] = parseStarters(
      "اشرح الآية | ما تفسير الآية 43 من سورة النحل؟",
    );
    expect(kept?.icon).toBe("quran");
  });
});
