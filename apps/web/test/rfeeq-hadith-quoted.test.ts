import { normaliseArabic } from "@/lib/verify-quotes";
import { describe, expect, it } from "vitest";

/**
 * Matching a quoted hadith to the report it came from.
 *
 * An inline «…» quotation reaches the renderer as text and nothing else —
 * `markScriptureQuotes` is a pass over the answer's prose, so it carries no
 * chunk id. The matn is matched on its normalised words, which is how this
 * codebase already decides whether a quotation is supported, and it is what
 * lets *every* hadith in an answer open its own details rather than one link at
 * the foot standing in for all of them.
 *
 * The rule under test is the one that can go wrong: how short a quotation may
 * be before it stops identifying anything.
 */
const MATNS = [
  "عن حفصة رضي الله عنها قال رسول الله صلى الله عليه وسلم: من لم يُجمِع الصيام قبل الفجر فلا صيام له",
  "عن عمر بن الخطاب رضي الله عنه قال: قال رسول الله صلى الله عليه وسلم: إنما الأعمال بالنيات",
].map((text) => ({ matn: normaliseArabic(text), text }));

/** The resolution rule as `sources.tsx` applies it. */
const quoted = (quote: string) => {
  const needle = normaliseArabic(quote);
  if (needle.length < 12) return null;
  return (
    MATNS.find((entry) => entry.matn.includes(needle)) ??
    MATNS.find((entry) => needle.includes(entry.matn)) ??
    null
  );
};

describe("a quoted hadith", () => {
  it("finds the report it was taken from", () => {
    expect(quoted("من لم يُجمِع الصيام قبل الفجر فلا صيام له")?.text).toContain(
      "حفصة",
    );
  });

  it("tells two reports in the same answer apart", () => {
    expect(quoted("إنما الأعمال بالنيات")?.text).toContain("عمر بن الخطاب");
    expect(quoted("من لم يُجمِع الصيام قبل الفجر")?.text).toContain("حفصة");
  });

  /*
   * A phrase this short occurs in every matn retrieved. Matching on it would
   * open whichever hadith happened to be first, which is the failure the foot
   * link already had and this is meant to replace.
   */
  it("refuses a phrase too short to identify one", () => {
    expect(quoted("قال رسول")).toBeNull();
    expect(quoted("الله")).toBeNull();
  });

  /* tashkīl, hamza seating and ta marbūṭa must not decide the match */
  it("matches across spelling and diacritics", () => {
    expect(quoted("مَنْ لَمْ يُجْمِعِ الصِّيَامَ قَبْلَ الفَجْرِ")?.text).toContain(
      "حفصة",
    );
  });

  it("returns nothing for a quotation from no retrieved report", () => {
    expect(quoted("اطلبوا العلم ولو بالصين فإن طلب العلم فريضة")).toBeNull();
  });
});

/**
 * A quoted verse resolves the same way, and for the same reason.
 *
 * علوم الآية is keyed on sūra and āya, and an inline quotation carries neither
 * — so without a match a quoted verse could only open an enlargement: the same
 * words, larger, and nothing the reader did not already have.
 */
const VERSES = [
  { text: "ٱدۡعُ إِلَىٰ سَبِيلِ رَبِّكَ بِٱلۡحِكۡمَةِ وَٱلۡمَوۡعِظَةِ ٱلۡحَسَنَةِ", surah: 16, ayah: 125 },
  { text: "قُلۡ هُوَ ٱللَّهُ أَحَدٌ", surah: 112, ayah: 1 },
].map((v) => ({ ...v, norm: normaliseArabic(v.text) }));

const verseQuoted = (quote: string) => {
  const needle = normaliseArabic(quote);
  if (needle.length < 12) return null;
  return (
    VERSES.find((v) => v.norm.includes(needle)) ??
    VERSES.find((v) => needle.includes(v.norm)) ??
    null
  );
};

describe("a quoted verse", () => {
  it("finds the āya it was taken from", () => {
    const found = verseQuoted("ٱدۡعُ إِلَىٰ سَبِيلِ رَبِّكَ بِٱلۡحِكۡمَةِ");
    expect(found?.surah).toBe(16);
    expect(found?.ayah).toBe(125);
  });

  it("matches across ʿUthmānī spelling and plain", () => {
    expect(verseQuoted("ادع الى سبيل ربك بالحكمة")?.ayah).toBe(125);
  });

  /*
   * «بسم الله» opens half the Qurʾān; matching on it would send the reader to
   * whichever verse happened to be retrieved first.
   */
  it("refuses a span too short to name one āya", () => {
    expect(verseQuoted("قل هو")).toBeNull();
  });

  it("returns nothing for a verse that was not retrieved", () => {
    expect(verseQuoted("وَٱلۡعَصۡرِ إِنَّ ٱلۡإِنسَٰنَ لَفِي خُسۡرٍ")).toBeNull();
  });
});
