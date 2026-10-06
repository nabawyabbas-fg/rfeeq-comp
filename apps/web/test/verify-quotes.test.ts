import { markScriptureQuotes, markUnverifiedQuotes } from "@/lib/verify-quotes";
import { describe, expect, it } from "vitest";

/**
 * Arabic puts a book's title in « » as well as a hadith's matn, so a hadith
 * answer naming the works that graded a report is full of spans that look like
 * quotations and are not. The cases below are taken from real answers.
 */
describe("book titles are references, not quotations", () => {
  it.each([
    ["حكم عليه السخاوي بالضعف في كتابه «المقاصد الحسنة».", "«المقاصد الحسنة»"],
    ["وبيّن ابن القيسراني في «ذخيرة الحفاظ» ضعفه.", "«ذخيرة الحفاظ»"],
    ["ذكر ابن عدي في «الكامل في الضعفاء» الرواية.", "«الكامل في الضعفاء»"],
    ["وضعَّفه السيوطي في «الجامع الصغير».", "«الجامع الصغير»"],
  ])("leaves %s alone", (text, title) => {
    expect(markScriptureQuotes(text)).not.toContain("<scripture");
    expect(markScriptureQuotes(text)).toContain(title);
  });

  /*
   * The visible harm: a title that does not happen to appear verbatim in the
   * retrieved passages was flagged unverified, which tells the reader something
   * untrue about the answer.
   */
  it("never flags a title as an unverified quotation", () => {
    const text = "أورده السخاوي في «المقاصد الحسنة».";
    expect(
      markUnverifiedQuotes(text, "نصٌّ مسترجع لا يذكر الكتاب"),
    ).not.toContain("<unverified>");
  });
});

describe("what is still treated as a quotation", () => {
  it.each([
    [
      "حديث «اطلبوا العلمَ ولو بالصينِ فإنَّ طلبَ العلمِ فريضةٌ»",
      "a matn after حديث",
    ],
    ["وأن زيادة «اطلبوا العلم ولو بالصين» باطلة", "after زيادة"],
    ["أما جملة «طَلَبُ العِلمِ فريضةٌ على كُلِّ مُسلمٍ» فثابتة", "after جملة"],
    [
      "قال البيهقي: «متنه مشهور وإسناده ضعيف وروي من أوجه»",
      "a scholar's verdict",
    ],
    ["وذكر أنه «لم يُخْرَج من حديث صحيح» بهذا اللفظ", "a verdict after أنه"],
  ])("marks %s (%s)", (text) => {
    expect(markScriptureQuotes(text)).toContain('<scripture kind="hadith">');
  });

  /*
   * A scholar's verdict IS a real quotation from a retrieved page, so checking
   * it against those pages is right — only the title case has nothing to check.
   */
  it("still verifies a verdict against the sources", () => {
    const text = "قال البيهقي: «متنه مشهور وإسناده ضعيف وروي من أوجه».";
    expect(markUnverifiedQuotes(text, "لا شيء مطابق هنا")).toContain(
      "<unverified>",
    );
  });

  it("keeps a long span even after في, where a title would be short", () => {
    const long =
      "جاء في «من خرج في طلب العلم فهو في سبيل الله حتى يرجع إلى أهله سالما غانما»";
    expect(markScriptureQuotes(long)).toContain('<scripture kind="hadith">');
  });

  it("always marks a Qurʾānic span, whatever precedes it", () => {
    const text =
      "قال تعالى في كتابه ﴿فَاسْأَلُوا أَهْلَ الذِّكْرِ إِن كُنتُمْ لَا تَعْلَمُونَ﴾";
    expect(markScriptureQuotes(text)).toContain('<scripture kind="quran">');
  });
});
