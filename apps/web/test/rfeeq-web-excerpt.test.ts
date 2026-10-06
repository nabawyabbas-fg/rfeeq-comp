import { quotedOnly } from "@/lib/rfeeq/sources/web-search";
import { describe, expect, it } from "vitest";

/**
 * A source card must show the page's words, not the researcher's.
 *
 * The web search returns one model turn containing both: narration that frames
 * each find, and the verbatim quotation itself. The excerpt was the whole span
 * before a citation marker, so a card read «2. من صفحة الموسوعة الحديثية
 * الخاصة بابن باز: "إذا أفطر أحدُكم…"» — an enumerator and a lead-in written by
 * a model, printed as though the source had said them.
 */
describe("the page's own words", () => {
  it("drops the narration around a marked quotation", () => {
    expect(
      quotedOnly(
        '2. من صفحة الموسوعة الحديثية الخاصة بابن باز: <q>إذا أفطرَ أحدُكمْ فليُفطرْ على تمرٍ فإنَّهُ بركةٌ</q> وهذا يوافق ما سبق',
      ),
    ).toBe("إذا أفطرَ أحدُكمْ فليُفطرْ على تمرٍ فإنَّهُ بركةٌ");
  });

  it("keeps several quotations from one span, in order", () => {
    expect(
      quotedOnly(
        "فيما يلي: <q>الراوي : سلمان بن عامر الضبي | المحدث : ابن حزم</q> ثم <q>خلاصة حكم المحدث : احتج به وقال في المقدمة</q>",
      ),
    ).toBe(
      "الراوي : سلمان بن عامر الضبي | المحدث : ابن حزم\n\nخلاصة حكم المحدث : احتج به وقال في المقدمة",
    );
  });

  /*
   * Why a tag and not quotation marks. Arabic quotation nests: the matn sits in
   * « » inside the citation's " ", so the outer quote closes on the inner one
   * and the extract stops mid-sentence. A tag has no such ambiguity.
   */
  it("keeps a nested Arabic quotation whole", () => {
    const span =
      'صفحة تنص: <q>قال رسول الله صلى الله عليه وسلم: «إذا أفطر أحدكم فليفطر على تمر» رواه الترمذي</q>';
    const out = quotedOnly(span);
    expect(out).toContain("«إذا أفطر أحدكم فليفطر على تمر»");
    expect(out).toContain("رواه الترمذي");
    expect(out).not.toContain("صفحة تنص");
  });

  /*
   * The span is cut at the citation marker, which sits right after the
   * quotation the model was in the middle of — so an unclosed tag is normal,
   * not malformed.
   */
  it("keeps the tail of an unterminated quotation", () => {
    expect(
      quotedOnly("ومما ورد فيها: <q>خلاصة حكم المحدث : إسناده جيد والحديث ثابت"),
    ).toBe("خلاصة حكم المحدث : إسناده جيد والحديث ثابت");
  });

  it("ignores a fragment too short to be a passage", () => {
    const span = "تمهيد طويل من الباحث يصف الصفحة ثم <q>نعم</q> وبعده كلام آخر";
    expect(quotedOnly(span)).toBe(span.replace(/<\/?q>/g, ""));
  });

  /*
   * A run where the model ignored the tag stays answerable rather than empty;
   * `metadata.extracted` is what marks this provenance as weaker than an API's.
   */
  it("falls back to the span, with no tags left in it", () => {
    expect(quotedOnly("نصّ بلا وسم إطلاقًا من الصفحة المقتبسة")).toBe(
      "نصّ بلا وسم إطلاقًا من الصفحة المقتبسة",
    );
    expect(quotedOnly("<q>قصير</q> بقية الكلام هنا وهو طويل كفاية")).not.toContain(
      "<q>",
    );
  });
});
