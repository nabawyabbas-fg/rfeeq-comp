import { parseDorarRulings } from "@/lib/rfeeq/sources/dorar";
import SEARCH from "./fixtures/dorar-hadith-search.json";
import { describe, expect, it } from "vitest";

/**
 * The text these are parsed out of is الموسوعة الحديثية's own ruling block, as
 * the approved web search returns it. Dorar runs fields together — «المصدر :
 * غاية المرام الصفحة أو الرقم : 14» arrives with no separator between the book
 * and the page — so the parser slices between label positions rather than
 * splitting on «|», which would put the page number inside the book's name.
 */
const PAGE = `##### - إنما الأعمالُ بالنياتِ وإنما لكلِّ امرئٍ ما نَوَى ...
الراوي : عمر بن الخطاب | المحدث : الألباني | المصدر : غاية المرام
الصفحة أو الرقم : 14 خلاصة حكم المحدث : صحيح
التخريج : أخرجه البخاري (1)، وأبو داود (2201) بلفظه، ومسلم (1907) بلفظ مقارب`;

describe("a ruling block from الموسوعة الحديثية", () => {
  const [ruling] = parseDorarRulings(PAGE);

  it("keeps the book and the page apart", () => {
    expect(ruling?.source).toBe("غاية المرام");
    expect(ruling?.locus).toBe("14");
  });

  it("reads the narrator, the muḥaddith and the verdict", () => {
    expect(ruling?.narrator).toBe("عمر بن الخطاب");
    expect(ruling?.muhaddith).toBe("الألباني");
    // the muḥaddith's own word, never reworded
    expect(ruling?.grade).toBe("صحيح");
  });

  it("keeps the takhrīj whole", () => {
    expect(ruling?.takhrij).toContain("أخرجه البخاري (1)");
    expect(ruling?.takhrij).toContain("ومسلم (1907) بلفظ مقارب");
  });
});

describe("more than one muḥaddith on one matn", () => {
  it("starts a new ruling where a field repeats", () => {
    const rulings = parseDorarRulings(
      `الراوي : عمر بن الخطاب | المحدث : البخاري | المصدر : صحيح البخاري
       الصفحة أو الرقم : 1 خلاصة حكم المحدث : [صحيح]
       الراوي : أبو سعيد الخدري | المحدث : ابن عبدالبر | المصدر : التمهيد
       الصفحة أو الرقم : 21/270 خلاصة حكم المحدث : خطأ لا شك فيه`,
    );
    expect(rulings).toHaveLength(2);
    expect(rulings[0]?.muhaddith).toBe("البخاري");
    expect(rulings[1]?.muhaddith).toBe("ابن عبدالبر");
    expect(rulings[1]?.grade).toBe("خطأ لا شك فيه");
  });

  /*
   * «لا ينسب حديث دون مصدر وحكم معتمد» — the two travel together, so an entry
   * carrying only half of one is not an entry.
   */
  it("drops an entry with no grading behind it", () => {
    expect(parseDorarRulings("الراوي : عمر بن الخطاب رضي الله عنه")).toEqual([]);
  });

  it("returns nothing for a page that carries no ruling block", () => {
    expect(parseDorarRulings("مقدمة الموسوعة الحديثية وطريقة استعمالها")).toEqual([]);
  });
});

/**
 * The real return of one approved web search for «إنما الأعمال بالنيات»,
 * captured verbatim.
 *
 * It carries two kinds of text about the same page: Dorar's ruling block quoted
 * word for word, and the search model's own summary of it — «- **الراوي**: عمر
 * بن الخطاب رضي الله عنه - الألباني، حكمه: صحيح». Both use the same labels and
 * the same colons. Reading the second would put a model's paraphrase on screen
 * under a muḥaddith's name, so only the first may parse.
 */
describe("a whole search result", () => {
  const rulings = SEARCH.flatMap(parseDorarRulings);

  it("reads only the blocks quoted verbatim", () => {
    expect(rulings).toHaveLength(3);
    expect(rulings.map((r) => r.muhaddith)).toEqual([
      "الألباني",
      "الألباني",
      "البخاري",
    ]);
  });

  it("keeps Dorar's own wording, brackets included", () => {
    // «[صحيح]» is Dorar's convention and not a typo to be cleaned up
    expect(rulings[2]?.grade).toBe("[صحيح]");
    expect(rulings[2]?.source).toBe("صحيح البخاري");
    expect(rulings[2]?.locus).toBe("6689");
  });

  it("reads a block whose verdict comes before its narrator", () => {
    // chunk 2 lists خلاصة حكم المحدث first; order is the page's, not ours
    expect(rulings[2]?.narrator).toBe("عمر بن الخطاب");
  });

  /*
   * The summary restates every field with markdown emphasis and no space before
   * the colon. If any of it parsed, these names would appear as rulings.
   */
  it("refuses the summarising prose", () => {
    const summary = SEARCH.slice(3).join("\n");
    expect(summary).toContain("**الراوي**");
    expect(parseDorarRulings(summary)).toEqual([]);
  });
});

/**
 * Why the rulings are parsed per page rather than per excerpt.
 *
 * The web search marks each verbatim quotation separately, so one Dorar ruling
 * block — الراوي، المحدث، المصدر، الصفحة، خلاصة الحكم — can arrive as two
 * excerpts of the same page. Read one at a time, such a block loses *every*
 * ruling: the half holding the narrator has no verdict, the half holding the
 * verdict has no muḥaddith, and the filter drops both.
 */
describe("a ruling block split across excerpts", () => {
  const head = "الراوي : سلمان بن عامر الضبي | المحدث : ابن حزم | المصدر : المحلى الصفحة أو الرقم : 7/31";
  const tail = "خلاصة حكم المحدث : احتج به وقال في المقدمة لم نحتج إلا بخبر صحيح";

  it("yields nothing when each half is read on its own", () => {
    expect(parseDorarRulings(head)).toEqual([]);
    expect(parseDorarRulings(tail)).toEqual([]);
  });

  it("yields the ruling once the page's excerpts are joined", () => {
    const [ruling] = parseDorarRulings(`${head}\n${tail}`);
    expect(ruling?.muhaddith).toBe("ابن حزم");
    expect(ruling?.narrator).toBe("سلمان بن عامر الضبي");
    expect(ruling?.source).toBe("المحلى");
    expect(ruling?.grade).toContain("احتج به");
  });
});
