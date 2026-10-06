import { surahNames } from "@/lib/rfeeq/sources/mcp/sciences";
import INFO from "./fixtures/surah-names-info.json";
import { describe, expect, it } from "vitest";

/**
 * «أسماء السورة» showed one name for every sūra in the Qurʾān.
 *
 * `fetch_surah_info` returns a `names` array holding exactly one entry — for
 * البقرة, `["البقرة"]` — which is the one thing that block exists not to do.
 * The rest live in `names_info` on `get_surah_statistics`: a long essay that
 * opens with a summary listing them under their two headings, then repeats each
 * with its evidence.
 *
 * The fixture is that summary plus the first line of the essay after it, taken
 * from the centre's own response, so the cut between the two is what is tested
 * rather than assumed.
 */
const names = (surah: keyof typeof INFO) => surahNames(INFO[surah]);

describe("the names a sūra is known by", () => {
  it("reads both headings, not just the canonical name", () => {
    const [attested, chosen] = names("2");
    expect(attested).toEqual({
      kind: "توقيفية",
      names: ["سورة البقرة", "سورة الزهراء"],
    });
    expect(chosen?.names).toEqual([
      "سنام القرآن",
      "فسطاط القرآن",
      "سورة الكرسي",
      "سيدة السور",
    ]);
  });

  /*
   * الفاتحة is the hard case and the useful check: its own text says the names
   * were counted at twenty-five, and the summary lists exactly that many.
   */
  it("reads all twenty-five of al-Fātiḥa's", () => {
    const groups = names("1");
    expect(groups.flatMap((group) => group.names)).toHaveLength(25);
    expect(groups[0]?.names[0]).toBe("فاتحة الكتاب");
    expect(groups[1]?.names.at(-1)).toBe("سورة المنِّة");
  });

  it("keeps a name written as a quoted āya intact", () => {
    expect(names("112")[0]?.names).toEqual([
      "سورة الإخلاص",
      "سورة {قُلْ هُوَ اللهُ أَحَدٌ}",
    ]);
  });

  /* a sūra with only one heading gets one group, not an empty other */
  it("omits a heading the summary does not carry", () => {
    const groups = names("16");
    expect(groups).toHaveLength(1);
    expect(groups[0]?.kind).toBe("اجتهادية");
  });

  it("stops at the essay, which repeats every name with its evidence", () => {
    // the essay opens «*أسمائها التوقيفية*» — were it read, names would double
    expect(INFO["1"]).toContain("*أسمائها التوقيفية*");
    expect(names("1").flatMap((group) => group.names)).toHaveLength(25);
  });

  it("returns nothing rather than guessing when the field is absent", () => {
    expect(surahNames(undefined)).toEqual([]);
    expect(surahNames("سورة بلا أسماء مذكورة")).toEqual([]);
  });
});
