import { markScriptureQuotes, normaliseArabic } from "@/lib/verify-quotes";
import { describe, expect, it } from "vitest";

/**
 * Which kind a quotation is, when the delimiter says the wrong thing.
 *
 * «…» is the hadith's delimiter and ﴿ ﴾ the Qurʾān's, but the غريب القرآن
 * section quotes **Qurʾānic words** in guillemets — that is how the centre's
 * data writes a headword. Every one of them was being marked as a matn: set in
 * the hadith face, and, once quotations became openable, offering a reader
 * «أحكام المحدّثين» for a word of آية الكرسي.
 *
 * The script settles it. Measured across every passage this app has retrieved:
 * 73 of 73 Qurʾānic passages carry at least one ʿUthmānī-only mark, and 0 of 33
 * hadith passages do.
 */
const kindOf = (quote: string) =>
  /<scripture kind="([a-z]+)">/.exec(markScriptureQuotes(quote))?.[1] ?? null;

describe("a word of the Qurʾān quoted in guillemets", () => {
  /*
   * The headword from the آية الكرسي answer that prompted this. The shorter
   * ones in that same list — «ٱلۡقَيُّومُ»، «سِنَةٞ» — never reach this code:
   * `QUOTE` requires twelve characters inside « », so they are left as plain
   * text and were never mismarked.
   */
  it("is read as Qurʾān, not as a matn", () => {
    expect(kindOf("«وَلَا يَـُٔودُهُۥ»")).toBe("quran"); // U+06E5, small waw
  });

  it("reads a whole verse in guillemets as Qurʾān too", () => {
    expect(kindOf("«ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ ٱلۡحَىُّ ٱلۡقَيُّومُ»")).toBe("quran");
  });

  /* a word short enough to fall under the pattern is left alone entirely */
  it("leaves a headword too short to be a quotation unmarked", () => {
    expect(kindOf("«سِنَةٞ»")).toBeNull();
  });

  it("still reads ﴿ ﴾ as Qurʾān", () => {
    expect(kindOf("﴿ٱلۡحَمۡدُ لِلَّهِ﴾")).toBe("quran");
  });
});

describe("a hadith matn", () => {
  /*
   * The error that matters most runs the other way: a narration set in the
   * muṣḥaf's face is scripture presented where there is none. These are the
   * real matns, in the standard orthography the hadith encyclopedias write.
   */
  it("is still read as a matn", () => {
    expect(kindOf("«إِنَّمَا الأَعْمَالُ بِالنِّيَّةِ، وَإِنَّمَا لِامْرِئٍ مَا نَوَى»")).toBe(
      "hadith",
    );
    expect(kindOf("«مِنْ حُسْنِ إِسْلَامِ الْمَرْءِ تَرْكُهُ مَا لَا يَعْنِيهِ»")).toBe(
      "hadith",
    );
    expect(kindOf("«الدين النصيحة»")).toBe("hadith");
  });

  it("is still read as a matn when it carries no vowels at all", () => {
    expect(kindOf("«اطلبوا العلم ولو بالصين»")).toBe("hadith");
  });
});

/**
 * The normaliser folds the Qurʾānic annotation marks instead of spacing them.
 *
 * They used to survive the tashkīl pass and be caught by the catch-all, which
 * turns anything unrecognised into a *space* — so «بِٱلۡحِكۡمَةِ» came out as
 * «بال حك مه», three words where the source has one, and a correctly quoted
 * verse stopped matching the plain-script writing of itself.
 */
describe("normalising a verse", () => {
  it("keeps a word whole across ʿUthmānī marks", () => {
    expect(normaliseArabic("بِٱلۡحِكۡمَةِ")).toBe("بالحكمه");
  });

  it("brings ʿUthmānī and plain script to the same string", () => {
    expect(normaliseArabic("ٱدۡعُ إِلَىٰ سَبِيلِ رَبِّكَ بِٱلۡحِكۡمَةِ")).toBe(
      normaliseArabic("ادع الى سبيل ربك بالحكمة"),
    );
  });

  it("leaves a hadith in standard script untouched by the change", () => {
    expect(normaliseArabic("إِنَّمَا الأَعْمَالُ بِالنِّيَّةِ")).toBe(
      "انما الاعمال بالنيه",
    );
  });
});
