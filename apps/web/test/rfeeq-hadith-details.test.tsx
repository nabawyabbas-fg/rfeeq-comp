import type { FormattedChunk } from "@/lib/agentic-search/format-chunk";
import {
  HadithPanel,
  hadithDetailsOf,
} from "@/components/rfeeq/chat/hadith-panel";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/**
 * تفاصيل الحديث — what الدرر السنية adds to a hadith موسوعة الحديث already
 * graded.
 *
 * The encyclopedia gives one grading and one attribution, which is enough to
 * cite a hadith and not enough to study it. Dorar gives every ruling recorded
 * on the matn, and they disagree: «من حسن إسلام المرء» comes back حسن from
 * النووي, مرسل from البيهقي and ضعيف from ابن عدي. A panel that showed one of
 * those would be worse than one that showed none.
 */
const RULINGS = [
  {
    narrator: "أبو هريرة",
    muhaddith: "النووي",
    source: "الأربعون النووية",
    locus: "12",
    grade: "حسن",
    takhrij: "أخرجه الترمذي (2317)",
  },
  {
    narrator: "أبو هريرة",
    muhaddith: "ابن عدي",
    source: "الكامل في الضعفاء",
    locus: "5/454",
    grade: "[فيه] عبد الرحمن بن عبد الله بن عمر ضعيف",
  },
];

const chunk: FormattedChunk = {
  id: "hadeethenc-4560#0",
  documentId: "hadeethenc-4560",
  text: "عن أبي هريرة رضي الله عنه قال: «مِنْ حُسْنِ إِسْلَامِ الْمَرْءِ تَرْكُهُ مَا لَا يَعْنِيهِ»",
  metadata: {
    source: "hadeethenc",
    grade: "صحيح",
    attribution: "رواه الترمذي",
    narrator: "أبو هريرة",
    rulings: RULINGS,
  },
};

const render = (details: ReturnType<typeof hadithDetailsOf>) =>
  details ? renderToStaticMarkup(<HadithPanel details={details} />) : "";

describe("lifting the details off a chunk", () => {
  it("reads the matn, the encyclopedia's grading and the rulings", () => {
    const details = hadithDetailsOf(chunk);
    expect(details?.grade).toBe("صحيح");
    expect(details?.attribution).toBe("رواه الترمذي");
    expect(details?.rulings).toHaveLength(2);
  });

  it("is not a hadith when it did not come from the hadith encyclopedia", () => {
    expect(
      hadithDetailsOf({ ...chunk, metadata: { source: "quranenc" } }),
    ).toBeNull();
  });

  /*
   * A conversation saved before Dorar was consulted reloads with no rulings at
   * all. That is a panel saying so, not a crash.
   */
  it("survives a chunk stored before the rulings existed", () => {
    const details = hadithDetailsOf({
      ...chunk,
      metadata: { source: "hadeethenc", grade: "صحيح" },
    });
    expect(details?.rulings).toEqual([]);
    expect(render(details)).toContain("لم يرد لهذا الحديث حكم");
  });
});

describe("the panel", () => {
  const html = render(hadithDetailsOf(chunk));

  it("names every muḥaddith with the book and page ruled in", () => {
    expect(html).toContain("النووي");
    expect(html).toContain("الأربعون النووية");
    expect(html).toContain("5/454");
  });

  it("keeps each verdict in that muḥaddith's own words", () => {
    expect(html).toContain("حسن");
    expect(html).toContain("[فيه] عبد الرحمن بن عبد الله بن عمر ضعيف");
  });

  it("colours a sound and a weak verdict differently", () => {
    expect(html).toContain("rf-success");
    expect(html).toContain("rf-danger");
  });

  it("leads each ruling with its narrator", () => {
    expect(html).toContain("الراوي");
    expect(html).toContain("أبو هريرة");
  });

  it("says where the rulings came from", () => {
    expect(html).toContain("الموسوعة الحديثية");
  });

  /* the muṣḥaf face is the Qurʾān's alone — a matn is set in the UI face */
  it("does not set the matn in the Qurʾān face", () => {
    expect(html).not.toContain("font-rf-quran");
  });
});
