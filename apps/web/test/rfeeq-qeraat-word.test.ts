import { describe, expect, it } from "vitest";

/**
 * Naming the word a qirāʾa belongs to.
 *
 * The block read «الكلمة ٤» and then four readings describing a word the reader
 * could not see — «قرأ بالهمزة، مع سكون الفاء» is about «كُفُوًا», and saying so
 * is the difference between a block that can be read and one that must be
 * decoded.
 *
 * `word_no` indexes مركز تفسير's tokenisation; splitting the āya on whitespace
 * is ours. They agree in practice, and "in practice" is not a basis for
 * printing one word where a reading belongs to another — a qirāʾa attached to
 * the wrong word is a claim about the Qurʾān the source did not make. So the
 * split is checked against the count the centre itself reports.
 */
const wordsOf = (candidates: (string | null)[], expected: number | null) => {
  if (!expected) return [];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const split = candidate.split(/\s+/).filter(Boolean);
    if (split.length === expected) return split;
  }
  return [];
};

const POINTED = "وَلَمۡ يَكُن لَّهُۥ كُفُوًا أَحَدُۢ";
const STRIPPED = "ولم يكن له كفوا أحد";

describe("the word a reading belongs to", () => {
  it("is the one the centre's own index points at", () => {
    expect(wordsOf([POINTED], 5)[3]).toBe("كُفُوًا");
  });

  /*
   * Both sources carry the same āya and only one is pointed: `fetch_ayah`
   * returns it stripped, while the document fetched for the translation carries
   * the muṣḥaf's own spelling — which is what belongs beside readings that turn
   * on a hamza and a sukūn.
   */
  it("prefers the pointed text when both are available", () => {
    expect(wordsOf([POINTED, STRIPPED], 5)[3]).toBe("كُفُوًا");
    expect(wordsOf([null, STRIPPED], 5)[3]).toBe("كفوا");
  });

  /*
   * The guard. When our split disagrees with the centre's count the words are
   * dropped entirely and the block shows «الكلمة ٤» as it always did — poorer,
   * and still true.
   */
  it("is withheld when the two tokenisations disagree", () => {
    expect(wordsOf([POINTED], 7)).toEqual([]);
    expect(wordsOf(["كلمة واحدة فقط"], 5)).toEqual([]);
  });

  it("is withheld when the centre reports no count at all", () => {
    expect(wordsOf([POINTED], null)).toEqual([]);
  });
});
