import type { FormattedChunk } from "@/lib/agentic-search/format-chunk";
import { withDorarRulings } from "@/lib/rfeeq/sources/dorar";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * الدرر السنية has to appear in المصادر, not only behind تفاصيل الحديث.
 *
 * The pages were being read and then thrown away: the rulings went onto the
 * hadith as metadata and the pages they came from vanished, so a reader saw
 * three entries from موسوعة الحديث and no الدرر السنية — while the answer's
 * gradings leaned on it. A source the system actually read, and argues from,
 * must be in the list the reader checks it against.
 */
const RULING =
  "<q>الراوي : جابر بن عبدالله | المحدث : الألباني | المصدر : صحيح الترغيب " +
  "الصفحة أو الرقم : 2241 خلاصة حكم المحدث : حسن لغيره</q>";

const hadith: FormattedChunk = {
  id: "hadeethenc-66122#0",
  documentId: "hadeethenc-66122",
  text: "عن جابر بن عبد الله: «أعاذك الله من إمارة السفهاء»",
  metadata: { source: "hadeethenc", grade: "حسن", attribution: "رواه أحمد" },
};

/** One Responses API turn citing one allowed page. */
const searchReply = (body: string, url: string) => ({
  output: [
    {
      type: "message",
      content: [
        {
          text: body,
          annotations: [
            {
              type: "url_citation",
              url,
              title: "الموسوعة الحديثية",
              start_index: body.length,
              end_index: body.length,
            },
          ],
        },
      ],
    },
  ],
});

const reply = (value: unknown) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(value) } as Response);

afterEach(() => vi.unstubAllGlobals());

describe("a hadith read", () => {
  it("returns the Dorar pages beside the hadith, as sources of their own", async () => {
    vi.stubGlobal("fetch", () =>
      reply(searchReply(RULING, "https://dorar.net/h/abc123")),
    );

    const out = await withDorarRulings([hadith], "key");

    expect(out).toHaveLength(2);
    expect(out[0]?.documentId).toBe("hadeethenc-66122");
    expect(out[1]?.metadata?.source).toBe("dorar.net");
    // and the ruling still rides on the hadith itself, for تفاصيل الحديث
    expect(out[0]?.metadata?.rulings).toHaveLength(1);
    expect(out[0]?.metadata?.narrator).toBe("جابر بن عبدالله");
  });

  /*
   * A search that found a page but no ruling on it has found nothing citable.
   * Listing it would put a source in front of the reader that the answer never
   * rests on.
   */
  it("keeps a page that yielded no ruling out of the list", async () => {
    vi.stubGlobal("fetch", () =>
      reply(
        searchReply(
          "<q>مقدمة الموسوعة الحديثية وطريقة استعمالها والبحث فيها</q>",
          "https://dorar.net/h/zzz",
        ),
      ),
    );

    const out = await withDorarRulings([hadith], "key");
    expect(out).toHaveLength(1);
    expect(out[0]?.documentId).toBe("hadeethenc-66122");
  });

  it("is unchanged when there is no key to search with", async () => {
    expect(await withDorarRulings([hadith], undefined)).toEqual([hadith]);
  });
});

/**
 * A Dorar page carries its own grading, so «درجة الحديث» has something to
 * render from.
 *
 * موسوعة الحديث holds only authenticated reports, and Dorar's reason for being
 * in the allow-list is that it carries the rest. For those, nothing in the
 * answer had a structured grading at all: the section fell back to the model's
 * prose and the reader saw «حسن» set as ordinary text, with no badge and no
 * colour. The real answer that prompted this is one — `<part k="grade">` held
 * «حسن» and no `ref`.
 */
const page = (body: string, url = "https://dorar.net/h/one") =>
  vi.stubGlobal("fetch", () => reply(searchReply(body, url)));

describe("a grading read off a Dorar page", () => {
  it("rides on the page when its rulings agree", async () => {
    page(
      "<q>الراوي : أبو أمامة | المحدث : الألباني | المصدر : صحيح الجامع " +
        "الصفحة أو الرقم : 2170 خلاصة حكم المحدث : حسن\n" +
        "الراوي : جابر | المحدث : المنذري | المصدر : الترغيب " +
        "الصفحة أو الرقم : 2/95 خلاصة حكم المحدث : حسن لغيره</q>",
    );

    const [, dorar] = await withDorarRulings([hadith], "key");
    expect(dorar?.metadata?.grade).toBe("حسن");
    // the verdict is one muḥaddith's, and is shown as such
    expect(dorar?.metadata?.attribution).toBe("الألباني");
  });

  /*
   * A single coloured badge over a matn النووي called حسن and ابن عدي called
   * ضعيف would be the interface taking a side the sources have not. The
   * disagreement belongs in أحكام المحدّثين, muḥaddith by muḥaddith, and the
   * section falls back to prose — the honest rendering of a dispute.
   */
  it("attaches none when they disagree", async () => {
    page(
      "<q>الراوي : أبو هريرة | المحدث : النووي | المصدر : الأربعون " +
        "الصفحة أو الرقم : 12 خلاصة حكم المحدث : حسن\n" +
        "الراوي : أبو هريرة | المحدث : ابن عدي | المصدر : الكامل " +
        "الصفحة أو الرقم : 5/454 خلاصة حكم المحدث : ضعيف</q>",
    );

    const [, dorar] = await withDorarRulings([hadith], "key");
    expect(dorar?.metadata?.grade).toBeUndefined();
    // both verdicts still travel, for the pane that shows them side by side
    expect(dorar?.metadata?.rulings).toHaveLength(2);
  });
});
