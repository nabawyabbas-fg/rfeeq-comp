import type { FormattedChunk } from "@/lib/agentic-search/format-chunk";
import type { RenderSection } from "@/lib/rfeeq/sections";
import { SectionStack } from "@/components/rfeeq/chat/section";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/**
 * What the typed sections actually render.
 *
 * The claims this file makes are claims about markup — a section is folded or
 * it is not, a verse came from the chunk or from the model — and the only
 * honest way to check markup is to produce it. The parser tests next door prove
 * the right sections are *chosen*; these prove the right thing reaches the
 * page.
 */

const hadith: FormattedChunk = {
  id: "hadeethenc-4560#0",
  documentId: "hadeethenc-4560",
  text: "إِنَّمَا الْأَعْمَالُ بِالنِّيَّةِ، وَإِنَّمَا لِامْرِئٍ مَا نَوَى",
  metadata: {
    source: "hadeethenc",
    grade: "صحيح",
    attribution: "متفق عليه",
  },
};

const weak: FormattedChunk = {
  ...hadith,
  id: "hadeethenc-9999#0",
  documentId: "hadeethenc-9999",
  metadata: { source: "hadeethenc", grade: "ضعيف", attribution: "رواه البيهقي" },
};

const verse: FormattedChunk = {
  id: "quranenc-16-125#0",
  documentId: "quranenc-16-125",
  text: "ٱدۡعُ إِلَىٰ سَبِيلِ رَبِّكَ بِٱلۡحِكۡمَةِ",
  metadata: {
    source: "quranenc",
    sura: 16,
    aya: 125,
    surahName: "النحل",
  },
};

const section = (over: Partial<RenderSection>): RenderSection => ({
  key: "x",
  label: null,
  collapsed: false,
  kind: "prose",
  brief: "",
  body: "",
  ref: null,
  attrs: "",
  ...over,
});

const render = (
  sections: RenderSection[],
  { open = new Set<string>() }: { open?: Set<string> } = {},
) =>
  renderToStaticMarkup(
    <SectionStack
      sections={sections}
      open={open}
      chunkOf={(id) =>
        [hadith, weak, verse].find((chunk) => chunk.id === id) ?? null
      }
      prose={(body) => <p>{body}</p>}
    />,
  );

describe("structural sections render from the chunk", () => {
  /*
   * The reason the sections carry a `ref` at all. A verse that arrives through
   * `metadata` is verbatim by construction — no instruction about reproducing
   * diacritics has to hold for it to stay correct.
   */
  it("sets the retrieved verse, not anything the model wrote", () => {
    const html = render([
      section({
        key: "ayah",
        kind: "scripture",
        ref: verse.id,
        body: "نص مختلف كتبه النموذج",
      }),
    ]);
    expect(html).toContain("ٱدۡعُ إِلَىٰ سَبِيلِ");
    expect(html).not.toContain("نص مختلف");
    // the muṣḥaf brackets, set apart from the words they enclose
    expect(html).toContain("﴿");
    expect(html).toContain("﴾");
  });

  it("brackets a matn as a report, not as a verse", () => {
    const html = render([
      section({ key: "matn", kind: "scripture", ref: hadith.id }),
    ]);
    expect(html).toContain("«");
    expect(html).not.toContain("﴿");
  });

  it("builds the reference row from metadata, naming the sūra", () => {
    const html = render([
      section({ key: "reference", kind: "reference", ref: verse.id }),
    ]);
    expect(html).toContain("سورة النحل");
    expect(html).toContain("الآية 125");
  });

  /*
   * Naming a sūra from memory is what the prompt forbids for scripture, so an
   * unnamed sūra is referenced by number rather than by a guess.
   */
  it("falls back to the sūra number when no name was retrieved", () => {
    const html = renderToStaticMarkup(
      <SectionStack
        sections={[
          section({ key: "reference", kind: "reference", ref: "x#0" }),
        ]}
        open={new Set()}
        chunkOf={() => ({
          ...verse,
          id: "x#0",
          metadata: { source: "quranenc", sura: 16, aya: 125 },
        })}
        prose={(body) => <p>{body}</p>}
      />,
    );
    expect(html).toContain("سورة رقم 16");
    expect(html).not.toContain("النحل");
  });

  /*
   * A hallucinated id, or a restored conversation whose tool output was pruned.
   * The body usually still holds the quotation, so the reader sees the text
   * either way; only the guarantee is lost.
   */
  it("falls back to the model's prose when the ref does not resolve", () => {
    const html = render([
      section({
        key: "ayah",
        kind: "scripture",
        ref: "nothing#0",
        body: "ما كتبه النموذج",
      }),
    ]);
    expect(html).toContain("ما كتبه النموذج");
  });

  it("renders nothing for a ref that resolves to nothing and no prose", () => {
    expect(
      render([section({ key: "ayah", kind: "scripture", ref: "nothing#0" })]),
    ).toBe("");
  });
});

describe("the grading, in the bipolar colours", () => {
  it("shows the grading's own words beside the colour", () => {
    const html = render([
      section({ key: "grade", label: "الدرجة", kind: "grade", ref: hadith.id }),
    ]);
    // the words the muḥaddith used — never replaced by the colour
    expect(html).toContain("صحيح");
    expect(html).toContain("متفق عليه");
    expect(html).toContain("rf-success");
    expect(html).not.toContain("rf-danger");
    /*
     * The row is the grading and its attribution, and nothing else. It used to
     * carry «الأحكام منقولة بنصّها عن أصحابها» — a note about issuing fatwā,
     * printed under every hadith grading, where no ruling is being relayed at
     * all.
     */
    expect(html).not.toContain("منقولة بنصّها");
  });

  it("marks a weak grading in the other colour", () => {
    const html = render([
      section({ key: "grade", label: "الدرجة", kind: "grade", ref: weak.id }),
    ]);
    expect(html).toContain("ضعيف");
    expect(html).toContain("rf-danger");
    expect(html).not.toContain("rf-success");
  });
});

describe("the fold state is the template's, not the run's", () => {
  const fawaid = section({
    key: "fawaid",
    label: "الفوائد العملية",
    collapsed: true,
    body: "فائدة",
  });

  it("renders a collapsed section closed by default", () => {
    const html = render([fawaid]);
    expect(html).toContain("<details");
    expect(html).not.toContain('<details open');
    expect(html).toContain("الفوائد العملية");
  });

  /*
   * «تُفتح بالنقر إن لم يكن السؤال عنها، وتظهر مباشرة إن سُئل عنها» — serving
   * the answer folded when the reader asked for it is the one way progressive
   * disclosure becomes worse than none.
   */
  it("opens it when the question asked for it", () => {
    const html = render([fawaid], { open: new Set(["fawaid"]) });
    expect(html).toContain("<details open");
  });

  it("gives an expanded section a heading and no disclosure", () => {
    const html = render([
      section({ key: "tafsir", label: "تفسير الآية", body: "المعنى" }),
    ]);
    expect(html).toContain("<h3>تفسير الآية</h3>");
    expect(html).not.toContain("<details");
  });

  /*
   * A section whose content *is* the answer carries no heading: the ruling that
   * opens a fiqh answer, the verse, the reference row.
   */
  it("gives an unlabelled section no heading", () => {
    const html = render([section({ key: "ruling", body: "يجوز" })]);
    expect(html).not.toContain("<h3");
    expect(html).toContain("يجوز");
  });

  it("drops a section with nothing in it", () => {
    expect(render([section({ key: "fawaid", label: "الفوائد", body: "" })])).toBe(
      "",
    );
  });
});

describe("the stack renders in the order it was given", () => {
  it("keeps the template's order", () => {
    const html = render([
      section({ key: "ruling", body: "الحكم" }),
      section({ key: "detail", label: "التفصيل", body: "التفصيل" }),
      section({
        key: "evidence",
        label: "الأدلة",
        collapsed: true,
        body: "الدليل",
      }),
    ]);
    expect(html.indexOf("الحكم")).toBeLessThan(html.indexOf("التفصيل"));
    expect(html.indexOf("التفصيل")).toBeLessThan(html.indexOf("الأدلة"));
  });
});

/**
 * الأدلة on the page.
 *
 * The threshold, the ordering, the colours and the count badge are all claims
 * about markup, so they are checked by producing it.
 */
describe("the evidence table", () => {
  const two =
    '<ev t="السنة" by="جمهور العلماء" why="فعله ﷺ دليل الجواز" src="البخاري (1106)" ids="hadeethenc-4560#0">«كان النبيُّ ﷺ يَجمَعُ»</ev>' +
    '<ev t="القرآن" by="عامة أهل العلم" why="نفى الله الحرج" src="النساء ١٠١">﴿فَلَيْسَ عَلَيْكُمْ جُنَاحٌ﴾</ev>';

  const evidence = (body: string, attrs = "") =>
    section({
      key: "evidence",
      label: "الأدلة",
      collapsed: true,
      kind: "evidence",
      body,
      attrs,
    });

  it("renders a table at two proofs, with the four columns", () => {
    const html = render([evidence(two)], { open: new Set(["evidence"]) });
    expect(html).toContain("<table");
    for (const head of ["العلماء", "الدليل", "وجه الاستدلال", "المصدر"]) {
      expect(html).toContain(head);
    }
  });

  /*
   * The hierarchy, on the page and not only in the data: a table that led with
   * the sunnah proof because the model wrote it first would misstate how the
   * ruling was reached.
   */
  it("puts the Qurʾānic proof above the prophetic one", () => {
    const html = render([evidence(two)], { open: new Set(["evidence"]) });
    expect(html.indexOf("جُنَاحٌ")).toBeLessThan(html.indexOf("يَجمَعُ"));
  });

  it("gives each type its own colour", () => {
    const html = render([evidence(two)], { open: new Set(["evidence"]) });
    expect(html).toContain("border-s-rf-q"); // قرآن
    expect(html).toContain("border-s-rf-s"); // سنة
    expect(html).toContain("قرآن");
    expect(html).toContain("سنة");
  });

  it("heads the table with the masʾala when one was given", () => {
    const html = render([evidence(two, 'issue="قصر الصلاة في السفر"')], {
      open: new Set(["evidence"]),
    });
    expect(html).toContain("<caption");
    expect(html).toContain("المسألة:");
    expect(html).toContain("قصر الصلاة في السفر");
  });

  /* «دليلان على الأقل، وإلا تُعرض الأدلة بالترتيب» */
  it("renders one proof as a list, not a table", () => {
    const html = render(
      [evidence('<ev t="السنة" src="البخاري">«حديث»</ev>')],
      { open: new Set(["evidence"]) },
    );
    expect(html).not.toContain("<table");
    expect(html).toContain("<ol");
    expect(html).toContain("البخاري");
  });

  /*
   * «البطاقة تَعُدّ وتلخّص ثم تفتح عند الطلب» — the count is what tells a reader
   * whether the fold is worth opening.
   */
  it("counts the proofs on the closed summary", () => {
    const html = render([evidence(two)]);
    expect(html).toContain("<details");
    expect(html).not.toContain("<details open");
    expect(html).toContain(">2<");
  });

  it("renders nothing when no proof could be read", () => {
    expect(render([evidence("<ev>نص بلا نوع</ev>")])).toBe("");
  });

  it("carries each proof's citation", () => {
    const html = render([evidence(two)], { open: new Set(["evidence"]) });
    expect(html).toContain("hadeethenc-4560#0");
  });
});

/**
 * «ما يُنقر: الكلمة · الآية · السورة».
 *
 * The specification lists what opens a pane. Two of the three are the reference
 * row and the third is the verse itself — and a tap must only be offered where
 * something can answer for it.
 */
describe("what opens a side pane", () => {
  const taps = {
    onSurah: () => undefined,
    onAyah: () => undefined,
    onWord: () => undefined,
  };

  const withTaps = (sections: RenderSection[]) =>
    renderToStaticMarkup(
      <SectionStack
        sections={sections}
        open={new Set()}
        chunkOf={(id) =>
          [hadith, verse].find((chunk) => chunk.id === id) ?? null
        }
        prose={(body) => <p>{body}</p>}
        {...taps}
      />,
    );

  it("makes each word of a verse its own control", () => {
    const html = withTaps([
      section({ key: "ayah", kind: "scripture", ref: verse.id }),
    ]);
    const buttons = html.match(/<button/g) ?? [];
    /*
     * One per word, plus the āya mark that closes the verse — and no outer
     * button wrapping them, since buttons do not nest. The mark is how a single
     * verse reaches its own pane now that every word is a control.
     */
    expect(buttons).toHaveLength(verse.text.split(/\s+/).length + 1);
    expect(html).toContain("علوم الكلمة: ٱدۡعُ");
    expect(html).toContain('aria-label="علوم الآية 125"');
  });

  /*
   * `<button>` is inline-block and JSX puts nothing between mapped siblings, so
   * the first version rendered the whole verse as one unbroken run —
   * «ٱدۡعُإِلَىٰسَبِيلِ». The count assertion above passed throughout, which is
   * why this one exists.
   */
  it("keeps the words apart", () => {
    const html = withTaps([
      section({ key: "ayah", kind: "scripture", ref: verse.id }),
    ]);
    expect(html).toContain("</button> <button");
    // and the spaces are real text, so copying the verse out keeps them
    const words = html.match(/<button[^>]*>([^<]+)<\/button>/g) ?? [];
    expect(words.length).toBeGreaterThan(1);
  });

  /*
   * `cn` is tailwind-merge, which cannot tell a custom `text-<size>` token from
   * a custom `text-<colour>` one and keeps only the last. Through `cn` this
   * button lost `text-rf-quran-sm` and the words rendered at the browser's
   * default button size instead of the Qurʾānic reading size.
   */
  it("keeps the words at the answer's Qurʾānic size", () => {
    const html = withTaps([
      section({ key: "ayah", kind: "scripture", ref: verse.id }),
    ]);
    const button = /<button[^>]*class="([^"]*)"/.exec(html)?.[1] ?? "";
    // `text-rf-answer-q` since the v1.10 sync — 16 on a 50px leading
    expect(button).toContain("text-rf-answer-q");
    expect(button).toContain("text-rf-text");
    expect(button).toContain("font-rf-quran");
  });

  /*
   * `ANSWER_PROSE` sets `[&_p]:my-0`, a descendant selector that outranks a
   * utility on the element, so as a paragraph the verse had no vertical space
   * at all — and a `p` inside the quote-panel `button` violates the button's
   * content model, which permits phrasing content only.
   */
  it("sets the verse in a block span rather than a paragraph", () => {
    const words = withTaps([
      section({ key: "ayah", kind: "scripture", ref: verse.id }),
    ]);
    expect(words).not.toContain("<p ");
    expect(words).toContain("my-3 block");

    const quoted = renderToStaticMarkup(
      <SectionStack
        sections={[section({ key: "matn", kind: "scripture", ref: hadith.id })]}
        open={new Set()}
        chunkOf={() => hadith}
        prose={(body) => <p>{body}</p>}
        onQuote={() => undefined}
      />,
    );
    // the whole matn is one button, and nothing flow-level sits inside it
    expect(quoted).toContain("<button");
    expect(quoted).not.toContain("<p ");
  });

  /*
   * The centre indexes the Qurʾān word by word and indexes nothing of the kind
   * for a matn, so the same affordance on a hadith would be a tap that leads
   * nowhere.
   */
  it("leaves a hadith's words alone", () => {
    const html = withTaps([
      section({ key: "matn", kind: "scripture", ref: hadith.id }),
    ]);
    expect(html).not.toContain("علوم الكلمة");
  });

  it("makes the sūra name and the āya number controls", () => {
    const html = withTaps([
      section({ key: "reference", kind: "reference", ref: verse.id }),
    ]);
    expect(html).toContain("سورة النحل");
    expect(html).toContain("الآية 125");
    expect((html.match(/<button/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  /*
   * Without the handlers the row is still a row. A control that opens nothing
   * is worse than plain text, because it promises something.
   */
  it("renders the reference as plain text when nothing can open", () => {
    const html = render([
      section({ key: "reference", kind: "reference", ref: verse.id }),
    ]);
    expect(html).toContain("سورة النحل");
    expect(html).not.toContain("<button");
  });

  /* A chunk with no coordinates cannot address a pane. */
  it("offers no word taps on a verse with no sūra or āya", () => {
    const html = renderToStaticMarkup(
      <SectionStack
        sections={[section({ key: "ayah", kind: "scripture", ref: "bare#0" })]}
        open={new Set()}
        chunkOf={() => ({
          id: "bare#0",
          documentId: "bare",
          text: "ٱدۡعُ إِلَىٰ سَبِيلِ",
          metadata: { source: "quranenc" },
        })}
        prose={(body) => <p>{body}</p>}
        {...taps}
      />,
    );
    expect(html).not.toContain("علوم الكلمة");
  });
});

/**
 * What a structural section does when its data is not what it needs.
 *
 * Both of these were visible in one answer: a dorar search result named as the
 * matn was dressed in ﴿ ﴾ and set at Qurʾānic reading size, and «الدرجة»
 * printed as a heading with nothing beneath it.
 */
describe("structural sections refuse to improvise", () => {
  const page: FormattedChunk = {
    id: "web-dorar-net-1778992#1",
    documentId: "web-dorar-net-1778992",
    text: "--- .2. من الموسوعة الحديثية: خلاصة حكم المحدث: متنه مشهور",
    metadata: { source: "dorar.net", sourceUrl: "https://dorar.net/h/1" },
  };

  const withPage = (sections: RenderSection[]) =>
    renderToStaticMarkup(
      <SectionStack
        sections={sections}
        open={new Set()}
        chunkOf={() => page}
        prose={(body) => <p>{body}</p>}
        onQuote={() => undefined}
      />,
    );

  /*
   * The kind used to default to "quran", so a scraped page was presented in the
   * muṣḥaf brackets. A page is not scripture, and dressing one as scripture is
   * the worst thing this renderer could do.
   */
  it("does not dress a retrieved web page as scripture", () => {
    const html = withPage([
      section({ key: "matn", kind: "scripture", ref: page.id }),
    ]);
    expect(html).not.toContain("﴿");
    expect(html).not.toContain("«");
    expect(html).not.toContain("font-rf-quran");
    expect(html).toBe("");
  });

  it("falls back to the model's own text when the ref is not a passage", () => {
    const html = withPage([
      section({
        key: "matn",
        kind: "scripture",
        ref: page.id,
        body: "«اطلبوا العلم ولو بالصين»",
      }),
    ]);
    expect(html).toContain("اطلبوا العلم");
  });

  /*
   * A React element is truthy even when the component inside returns null, so
   * the heading was printed above nothing at all.
   */
  it("prints no heading for a grading the source does not carry", () => {
    expect(
      withPage([
        section({ key: "grade", label: "الدرجة", kind: "grade", ref: page.id }),
      ]),
    ).toBe("");
  });

  it("prints no reference row for a chunk with nothing to locate it by", () => {
    expect(
      withPage([
        section({ key: "reference", kind: "reference", ref: page.id }),
      ]),
    ).toBe("");
  });

  /* And the real cases still render. */
  it("still renders a real grading and a real reference", () => {
    const html = render([
      section({ key: "grade", label: "الدرجة", kind: "grade", ref: hadith.id }),
      section({ key: "reference", kind: "reference", ref: verse.id }),
    ]);
    expect(html).toContain("الدرجة");
    expect(html).toContain("صحيح");
    expect(html).toContain("سورة النحل");
  });
});

/**
 * «الاستعمال القرآني» — the specification's §6 addition.
 *
 * Built from the concordance's own figures rather than written, for the same
 * reason the grading is: a model asked to repeat «ورد الجذر وقي ٢٥٨ مرة» in
 * prose is one digit away from being wrong about something a reader can check.
 */
describe("the Qurʾānic usage table", () => {
  const usage: FormattedChunk = {
    id: "tafsir-center-root-وقي#0",
    documentId: "tafsir-center-root-وقي",
    text: "ورد الجذر (وقي) في القرآن 258 مرة، في 63 سورة و237 آية، على 57 صيغة.",
    metadata: {
      source: "tafsir-center",
      kind: "quran-usage",
      usage: {
        word: "التقوى",
        analysed: "التقوى",
        root: "وقي",
        occurrences: 258,
        surahs: 63,
        ayahs: 237,
        distinctForms: 57,
        forms: [
          { form: "واتقوا", count: 38, example: { surah: 2, ayah: 48 } },
          { form: "المتقين", count: 23, example: { surah: 2, ayah: 180 } },
          { form: "تتقون", count: 19, example: null },
        ],
      },
    },
  };

  const renderUsage = (chunk: FormattedChunk) =>
    renderToStaticMarkup(
      <SectionStack
        sections={[
          section({ key: "quran_usage", kind: "usage", ref: chunk.id }),
        ]}
        open={new Set()}
        chunkOf={() => chunk}
        prose={(body) => <p>{body}</p>}
      />,
    );

  it("states the sentence the specification asks for", () => {
    const html = renderUsage(usage);
    expect(html).toContain("ورد الجذر (وقي) في القرآن 258 مرة");
  });

  it("tabulates الصيغة · عدد المرات · المثال", () => {
    const html = renderUsage(usage);
    for (const head of ["الصيغة", "عدد المرات", "المثال"]) {
      expect(html).toContain(head);
    }
    expect(html).toContain("واتقوا");
    expect(html).toContain("38");
    expect(html).toContain("2:48");
  });

  /* A form occurring thirty-eight times has no single text to quote. */
  it("leaves a form with no example marked rather than blank", () => {
    expect(renderUsage(usage)).toContain("—");
  });

  it("falls back when the chunk carries no usage", () => {
    const bare = { ...usage, metadata: { source: "tafsir-center" } };
    expect(renderUsage(bare)).toBe("");
  });

/**
 * v1.10 moves the line between faces one step in: the Qurʾān keeps the muṣḥaf
 * face, and a hadith — even the one the question is about — is set in the
 * answer's own face. «Asked-about hadith: answer-body font, not the Quran
 * font.» The earlier treatment gave both the Qurʾānic face.
 */
describe("which text gets the muṣḥaf face", () => {
  it("sets a verse in the Qurʾānic face", () => {
    const html = render([
      section({ key: "ayah", kind: "scripture", ref: verse.id }),
    ]);
    expect(html).toContain("font-rf-quran");
    expect(html).toContain("font-rf-mushaf"); // the ﴿ ﴾ brackets
  });

  /*
   * The matn takes the muṣḥaf face too, by the owner's instruction — which
   * reverses v1.10's «answer-body font, not the Quran font». What still keeps
   * the recited word apart from a narrated one is the brackets and the leading:
   * a verse is 16 on 50px inside ﴿ ﴾, a matn 16 on a leading of 2 inside « ».
   */
  /*
   * `text-rf-matn`, not `text-rf-answer`. The latter is the answer body's own
   * size — every paragraph, list item and table cell — which the matn used to
   * borrow; raising the matn through it would have resized the whole answer.
   */
  it("sets a matn in عثمان طه, at the matn's own size", () => {
    const html = render([
      section({ key: "matn", kind: "scripture", ref: hadith.id }),
    ]);
    expect(html).toContain("font-rf-matn");
    expect(html).toContain("text-rf-matn");
    expect(html).not.toContain("text-rf-answer");
    // the face a *verse* is set in stays the verse's alone
    expect(html).not.toContain("font-rf-quran");
    expect(html).toContain("«");
  });

  /*
   * KFGQPC ships Uthmanic Script HAFS in Regular alone. `font-weight: bold` on
   * a single-weight face makes the browser draw the glyph twice at an offset,
   * which on a naskh carrying tashkīl runs the diacritics into the letters
   * under them. `.rf-matn` thickens every contour by the same hairline instead
   * and turns that synthesis off outright.
   */
  it("weights the matn without letting the browser fake a bold", () => {
    const html = render([
      section({ key: "matn", kind: "scripture", ref: hadith.id }),
    ]);
    expect(html).toContain("rf-matn");
    expect(html).not.toContain("font-bold");
    expect(html).not.toContain("font-semibold");
  });

  /* Weight 400 throughout: the leading carries the emphasis, not the weight. */
  it("sets revealed text at normal weight", () => {
    const html = render([
      section({ key: "ayah", kind: "scripture", ref: verse.id }),
    ]);
    expect(html).not.toContain("font-semibold");
  });
});
});

/**
 * v1.10's «مصدر موثّق» tag: beside the heading, not under the text.
 *
 * The reader is deciding whether to trust a block before reading it, so the
 * signal belongs where the eye enters — and it names its provenance, so the tag
 * is a claim with a referent rather than a badge.
 */
describe("the trust tag", () => {
  it("sits in the heading and names the source", () => {
    const html = render([
      section({
        key: "tafsir",
        label: "المعنى الإجمالي",
        trust: true,
        trustSource: "المختصر في تفسير القرآن الكريم",
        // not a substring of the label, which now contains «المعنى» itself
        body: "شرحُ الآيةِ هنا",
      }),
    ]);
    expect(html).toContain("مصدر موثّق");
    expect(html).toContain("المختصر في تفسير القرآن الكريم");
    // inside the heading, above the body
    expect(html.indexOf("مصدر موثّق")).toBeLessThan(
      html.indexOf("شرحُ الآيةِ هنا"),
    );
  });

  it("is absent from a section the template does not mark", () => {
    const html = render([
      section({ key: "gharib", label: "غريب القرآن", body: "نص" }),
    ]);
    expect(html).not.toContain("مصدر موثّق");
  });

  /*
   * v1.10 quiets the grade badge: the page's own surface with a hairline
   * border and normal weight, the colour carried by a 7px dot. It was a filled
   * soft-colour chip at 15px semibold, which made the badge louder than the
   * grading's own words.
   */
  it("leaves the grading's words louder than the badge", () => {
    const html = render([
      section({ key: "grade", label: "الدرجة", kind: "grade", ref: hadith.id }),
    ]);
    expect(html).toContain("bg-rf-surface");
    expect(html).not.toContain("bg-rf-success-soft");
    expect(html).toContain("size-[7px]");
    expect(html).toContain("صحيح");
  });
});

/**
 * The two ways into تفاصيل الحديث.
 *
 * «when click on it … or when click on the hadith matn as well» — a chip that
 * names the destination, and the matn itself, which is where a reader's hand
 * goes first and which says nothing about being clickable on its own.
 */
const renderWith = (
  sections: RenderSection[],
  extra: {
    chunk?: FormattedChunk;
    onHadith?: (details: unknown) => void;
  } = {},
) =>
  renderToStaticMarkup(
    <SectionStack
      sections={sections}
      open={new Set<string>()}
      chunkOf={(id) =>
        extra.chunk ??
        [hadith, weak, verse].find((chunk) => chunk.id === id) ??
        null
      }
      onHadith={extra.onHadith as never}
      prose={(body) => <p>{body}</p>}
    />,
  );

/**
 * The two ways into تفاصيل الحديث.
 *
 * «when click on it … or when click on the hadith matn as well» — a chip that
 * names the destination, and the matn itself, which is where a reader's hand
 * goes first and which says nothing about being clickable on its own.
 */
describe("a matn opens its details", () => {
  const matn = section({ key: "matn", kind: "scripture", ref: hadith.id });
  const html = renderWith([matn], { onHadith: () => undefined });

  it("makes the matn one of the two ways in", () => {
    expect(html).toContain('aria-label="تفاصيل الحديث"');
  });

  /*
   * The named link lives at the foot of the answer, beside «المصادر», where the
   * answer's other exits are. Repeating it under every quoted matn would print
   * it several times on an answer that quotes more than one.
   */
  it("does not repeat the link under the matn", () => {
    expect(html).not.toContain(">تفاصيل الحديث<");
  });

  /*
   * A verse keeps the enlargement it always had: علوم الآية is reached by the
   * āya number, and تفاصيل الحديث is not something a verse has.
   */
  it("leaves a verse alone", () => {
    const verseHtml = renderWith(
      [section({ key: "ayah", kind: "scripture", ref: verse.id })],
      { onHadith: () => undefined },
    );
    expect(verseHtml).not.toContain("تفاصيل الحديث");
  });
});

/**
 * الراوي, which had nowhere to come from until Dorar was consulted.
 *
 * The reference row has asked for a narrator since it was written: موسوعة
 * الحديث returns the matn, the grading and the attribution, and the Companion
 * who narrated it is الدرر السنية's field.
 */
describe("the narrator in the reference row", () => {
  const row = section({ key: "ref", kind: "reference", ref: hadith.id });

  it("names it and sets it apart from the attribution", () => {
    const html = renderWith([row], {
      chunk: {
        ...hadith,
        metadata: { ...hadith.metadata, narrator: "عمر بن الخطاب" },
      },
    });
    expect(html).toContain("الراوي");
    expect(html).toContain("عمر بن الخطاب");
    expect(html).toContain("font-semibold");
    // the attribution is still there, and still quieter
    expect(html).toContain("متفق عليه");
  });

  it("renders the row without one rather than inventing one", () => {
    const html = renderWith([row], { chunk: hadith });
    expect(html).not.toContain("الراوي");
    expect(html).toContain("متفق عليه");
  });
});

/**
 * How each quote is measured.
 *
 * `text-wrap: balance` equalises line lengths, so the browser narrows the block
 * until they match. On a short centred verse that is the point; on a three-line
 * narration it leaves the matn ending well short of the column it sits in,
 * which is what it did once the muṣḥaf face tipped it from two lines to three.
 */
describe("how a quote is measured", () => {
  it("balances a verse, which is short and centred", () => {
    const html = render([
      section({ key: "ayah", kind: "scripture", ref: verse.id }),
    ]);
    expect(html).toContain("text-balance");
    expect(html).toContain("text-center");
  });

  it("gives a matn the whole column", () => {
    const html = render([
      section({ key: "matn", kind: "scripture", ref: hadith.id }),
    ]);
    expect(html).not.toContain("text-balance");
    expect(html).toContain("text-pretty");
  });
});

/**
 * The fold chevron sat on a line of its own under «أحكام المحدّثين».
 *
 * Tailwind's preflight sets `svg { display: block }`, so an `Icon` inside a
 * plain block container takes its own line. Every other Icon in the app lives
 * in a flex row, where a block child is blockified anyway; `<summary>` was the
 * one place that was not, so the summary is laid out as a row — which is also
 * what its label, «مصدر موثّق» tag and proof count wanted.
 */
describe("a collapsed section's heading", () => {
  const folded = section({
    key: "graders",
    label: "أحكام المحدّثين",
    collapsed: true,
    body: "قال النووي: حسن.",
  });

  it("is a details/summary, so the fold is the browser's", () => {
    const html = render([folded]);
    expect(html).toContain("<details");
    expect(html).toContain("<summary");
    expect(html).toContain("أحكام المحدّثين");
  });

  it("keeps the chevron on the heading's line", () => {
    const html = render([folded]);
    expect(html).toContain("#i-chev");
    // the row is established by the summary itself, so it survives whichever
    // frame renders the section
    expect(html).toMatch(/<summary class="[^"]*\bflex\b[^"]*items-center/);
  });
});

/**
 * A sūra short enough to read whole is shown whole.
 *
 * «تفسير سورة الإخلاص» retrieves all four of its verses — the model called
 * `quran_verse` with `throughAya: 4` and got them — and the answer showed one,
 * because the section rendered whatever single id the `ref` named. The ref is a
 * list now.
 */
const ikhlas: FormattedChunk[] = [
  { text: "قُلۡ هُوَ ٱللَّهُ أَحَدٌ", aya: 1 },
  { text: "ٱللَّهُ ٱلصَّمَدُ", aya: 2 },
  { text: "لَمۡ يَلِدۡ وَلَمۡ يُولَدۡ", aya: 3 },
  { text: "وَلَمۡ يَكُن لَّهُۥ كُفُوًا أَحَدُۢ", aya: 4 },
].map(({ text, aya }) => ({
  id: `quranenc-112-${aya}#0`,
  documentId: `quranenc-112-${aya}`,
  text,
  metadata: { source: "quranenc", sura: 112, aya, surahName: "الإخلاص" },
}));

const surah = (extra: Partial<Parameters<typeof renderWith>[1]> = {}) =>
  renderToStaticMarkup(
    <SectionStack
      sections={[
        section({
          key: "ayah",
          kind: "scripture",
          ref: ikhlas.map((chunk) => chunk.id).join(","),
        }),
      ]}
      open={new Set<string>()}
      chunkOf={(id) => ikhlas.find((chunk) => chunk.id === id) ?? null}
      onAyah={() => undefined}
      prose={(body) => <p>{body}</p>}
      {...extra}
    />,
  );

describe("a ref naming several verses", () => {
  it("renders every one of them", () => {
    const html = surah();
    for (const chunk of ikhlas) expect(html).toContain(chunk.text);
  });

  /*
   * The row of «الآية ١ · الآية ٢» links this replaced said the same thing
   * twice — once under the verses and once in the reference line directly
   * beneath, which is where «الآية ١» came out duplicated.
   */
  it("carries no separate row of links", () => {
    // the visible text, with attributes stripped: the marks read ۝٢, not «الآية ٢»
    const visible = surah().replace(/<[^>]*>/g, "");
    expect(visible).not.toContain("الآية");
    expect(visible).toContain("\u06DD٢");
  });

  /*
   * The numbered mark is the control, as it is the place a reader's eye already
   * stops at the end of an āya.
   */
  it("closes each verse with its own numbered mark", () => {
    const html = surah();
    for (const ayah of [1, 2, 3, 4]) {
      expect(html).toContain(`aria-label="علوم الآية ${ayah}"`);
    }
    // four circles and four numerals
    expect(html.match(/\u06DD/g)).toHaveLength(4);
    for (const n of ["١", "٢", "٣", "٤"]) expect(html).toContain(n);
  });

  /*
   * The numeral is overlaid, not written after the circle: this font's GSUB has
   * 56 lookups and none ligates U+06DD with a digit, so «۝٤» would render as an
   * empty circle with a 4 beside it.
   */
  it("overlays the numeral on the circle rather than trailing it", () => {
    const html = surah();
    expect(html).not.toContain("\u06DD١");
    expect(html).toContain("inline-grid");
  });

  /*
   * The mark is only an āya mark in the muṣḥaf face: KFGQPC draws the ornate
   * circle and the small numerals made to sit inside it. Inheriting the
   * answer's UI face gives a plain thin ring with a full-size number beside it.
   */
  it("sets the mark in the muṣḥaf face, like the verse", () => {
    const html = surah();
    const marks = [...html.matchAll(/<span class="([^"]*inline-grid[^"]*)"/g)];
    expect(marks).toHaveLength(4);
    for (const [, classes] of marks) expect(classes).toContain("font-rf-quran");
  });

  /*
   * One opening bracket and one closing, not a pair around every verse: a sūra
   * is continuous, and bracketing each āya sets it as four separate quotations.
   */
  it("brackets the passage once, not each verse", () => {
    const html = surah();
    expect(html.match(/﴿/g)).toHaveLength(1);
    expect(html.match(/﴾/g)).toHaveLength(1);
  });

  it("renders a single verse without a link row", () => {
    const html = renderToStaticMarkup(
      <SectionStack
        sections={[section({ key: "ayah", kind: "scripture", ref: ikhlas[0]!.id })]}
        open={new Set<string>()}
        chunkOf={() => ikhlas[0]!}
        onAyah={() => undefined}
        prose={(body) => <p>{body}</p>}
      />,
    );
    expect(html).toContain(ikhlas[0]!.text);
    expect(html).not.toContain("الآية 2");
  });
});

/**
 * A proof stands under the claim it proves.
 *
 * «الأدلة» was one folded block at the foot of a ruling. For «ما شروط صحة صيام
 * رمضان» — five conditions, each with its own evidence — that put the verse
 * establishing the time of الإمساك four screens below the sentence it
 * establishes, leaving the reader to pair them up from the `why` lines.
 */
const EV = (why: string, text: string) =>
  `<ev t="القرآن" by="الفقهاء" why="${why}" src="البقرة: 187" ids="quranenc-2-187#0">${text}</ev>`;

describe("evidence written beside its point", () => {
  const body =
    "- **النيّة:** لا يصح صوم رمضان بغير نية.\n" +
    EV("اشتراط النية", "إنما الأعمال بالنيات") +
    "\n- **الإمساك:** الامتناع عن المفطرات في وقته.\n" +
    EV("وقت الإمساك", "وكلوا واشربوا حتى يتبين لكم الخيط الأبيض");

  const html = () =>
    renderToStaticMarkup(
      <SectionStack
        sections={[section({ key: "detail", kind: "prose", body })]}
        open={new Set<string>()}
        chunkOf={() => null}
        prose={(text) => <p>{text}</p>}
      />,
    );

  it("renders each proof where it was written", () => {
    const out = html();
    const niyya = out.indexOf("النيّة");
    const first = out.indexOf("إنما الأعمال بالنيات");
    const imsak = out.indexOf("الإمساك");
    const second = out.indexOf("وكلوا واشربوا");

    // each proof falls between its own point and the next
    expect(niyya).toBeLessThan(first);
    expect(first).toBeLessThan(imsak);
    expect(imsak).toBeLessThan(second);
  });

  /*
   * Grouped per run, not globally: the قرآن ← سنة ← إجماع ← قياس ordering and
   * the two-proof table threshold order a point's proofs among themselves,
   * which is the only scope in which that ordering claims anything.
   */
  it("keeps the two proofs in separate blocks", () => {
    expect(html().match(/إنما الأعمال بالنيات/g)).toHaveLength(1);
    expect(html().match(/وكلوا واشربوا/g)).toHaveLength(1);
  });

  it("leaves a body with no markers as plain prose", () => {
    const plain = renderToStaticMarkup(
      <SectionStack
        sections={[section({ key: "detail", kind: "prose", body: "نصّ بلا أدلة" })]}
        open={new Set<string>()}
        chunkOf={() => null}
        prose={(text) => <p>{text}</p>}
      />,
    );
    expect(plain).toContain("نصّ بلا أدلة");
  });
});

/**
 * The reference line under a passage.
 *
 * It read «سورة الإخلاص · الآية ١» over four verses — naming the first and
 * silently dropping the rest. Listing all four would repeat what the numbered
 * marks already offer verse by verse directly above, so the row states the
 * range and leaves the links to the marks.
 */
describe("the reference line", () => {
  const row = (count: number) =>
    renderToStaticMarkup(
      <SectionStack
        sections={[
          section({
            key: "reference",
            kind: "reference",
            ref: ikhlas.slice(0, count).map((chunk) => chunk.id).join(","),
          }),
        ]}
        open={new Set<string>()}
        chunkOf={(id) => ikhlas.find((chunk) => chunk.id === id) ?? null}
        onAyah={() => undefined}
        onSurah={() => undefined}
        prose={(body) => <p>{body}</p>}
      />,
    );

  it("states the range when the passage has several verses", () => {
    const html = row(4);
    expect(html).toContain("الآيات ١–٤");
    expect(html).not.toMatch(/>الآية 1</);
  });

  it("keeps the single āya a link when there is only one", () => {
    const html = row(1);
    expect(html).toContain("الآية 1");
    expect(html).not.toContain("الآيات");
  });

  it("names the sūra either way", () => {
    expect(row(4)).toContain("سورة الإخلاص");
    expect(row(1)).toContain("سورة الإخلاص");
  });
});
