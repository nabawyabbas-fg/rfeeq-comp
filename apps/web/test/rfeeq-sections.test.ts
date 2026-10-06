import { detectLanguage, prose } from "@/lib/agentic-search/language";
import { citesNothing, markUncitedParagraphs } from "@/lib/uncited";
import { gradeTone } from "@/lib/rfeeq/grade";
import { asTable, parseProofs } from "@/lib/rfeeq/evidence";
import {
  DEFAULT_EXPERTISE,
  tafsirEditionsFor,
  withExpertise,
} from "@/lib/rfeeq/expertise";
import { rootFromSarf } from "@/lib/rfeeq/sources/mcp/sciences";
import { answerSections } from "@/lib/rfeeq/sections";
import {
  answerFormat,
  openSections,
  sectionsFor,
} from "@/lib/rfeeq/templates";
import { routeQuestion } from "@/lib/rfeeq/intent";
import { describe, expect, it } from "vitest";

/**
 * The template contract: an ordered list of named sections with a declared
 * collapse state.
 *
 * These tests exist because the thing being replaced — a prompt asking for a
 * shape — produced the right answer most of the time, and the specification
 * needs it every time. So what is asserted here is mostly *invariance*: the
 * order does not depend on what the model emitted, the fold state does not
 * depend on the run, and no text is ever lost to a formatting slip.
 */
describe("parsing an answer into sections", () => {
  /* Emitted out of order on purpose — the renderer puts them back. v1.10 leads
     with the commentary and folds غريب القرآن beneath it. */
  const tafsir = `<part k="ayah" ref="quranenc-16-125#0"></part>
<part k="reference" ref="quranenc-16-125#0"></part>
<part k="gharib">«الحكمة»: العلم النافع.</part>
<part k="tafsir">معنى الآية كذا.</part>`;

  it("reads the keys, the refs and the bodies", () => {
    const { ordered, tagged, loose } = answerSections(tafsir, "tafsir");

    expect(tagged).toBe(true);
    expect(loose).toBe("");
    expect(ordered.map((s) => s.key)).toEqual([
      "ayah",
      "reference",
      "tafsir",
      "gharib",
    ]);
    expect(ordered[0]?.ref).toBe("quranenc-16-125#0");
    expect(ordered[3]?.body).toContain("العلم النافع");
  });

  /*
   * The specification fixes the order — the ruling before its detail, the verse
   * before its commentary — so a model that emits them the other way round has
   * made a mistake the renderer can simply correct.
   */
  it("renders in the template's order, not the model's", () => {
    const { ordered } = answerSections(
      `<part k="detail">التفصيل</part><part k="ruling">الحكم</part>`,
      "fatwa",
    );
    expect(ordered.map((s) => s.key)).toEqual(["ruling", "detail"]);
  });

  it.each([
    ["an unquoted value", `<part k=gharib>نص</part>`],
    ["another attribute name", `<part key="gharib">نص</part>`],
    ["a never-closed tag", `<part k="gharib">نص`],
    ["a self-closed tag with a body following", `<part k="gharib" />نص`],
  ])("repairs %s", (_label, text) => {
    const { ordered } = answerSections(text, "tafsir");
    expect(ordered.map((s) => s.key)).toContain("gharib");
    expect(ordered.find((s) => s.key === "gharib")?.body).toContain("نص");
  });

  /*
   * The one rule the parser never breaks. A formatting slip must cost the
   * reader some structure, never an answer.
   */
  it("keeps text written outside the contract", () => {
    const { loose, ordered } = answerSections(
      `تقديم قبل أي وسم.<part k="tafsir">المعنى</part><part k="xyz">قسم غير معروف</part>`,
      "tafsir",
    );
    expect(loose).toContain("تقديم قبل أي وسم");
    expect(loose).toContain("قسم غير معروف");
    expect(ordered.map((s) => s.key)).toEqual(["tafsir"]);
  });

  it("concatenates a key the model split in two", () => {
    const { ordered } = answerSections(
      `<part k="gharib">الأولى</part><part k="gharib">الثانية</part>`,
      "tafsir",
    );
    expect(ordered).toHaveLength(1);
    expect(ordered[0]?.body).toContain("الأولى");
    expect(ordered[0]?.body).toContain("الثانية");
  });

  /*
   * A section with neither prose nor a ref was dropped on purpose: the format
   * instruction tells the model to omit a section it has no material for rather
   * than fill it with an apology.
   */
  it("drops a section that carries nothing", () => {
    const { ordered } = answerSections(
      `<part k="tafsir">المعنى</part><part k="gharib"></part>`,
      "tafsir",
    );
    expect(ordered.map((s) => s.key)).toEqual(["tafsir"]);
  });

  it("keeps a structural section that carries only a ref", () => {
    const { ordered } = answerSections(
      `<part k="ayah" ref="quranenc-1-1#0"></part>`,
      "tafsir",
    );
    expect(ordered).toHaveLength(1);
    expect(ordered[0]?.ref).toBe("quranenc-1-1#0");
  });

  it("reports an untagged answer rather than inventing sections", () => {
    const { tagged, ordered, loose } = answerSections("جواب بلا وسوم", "tafsir");
    expect(tagged).toBe(false);
    expect(ordered).toEqual([]);
    expect(loose).toBe("جواب بلا وسوم");
  });

  /*
   * Sections render while the answer streams, so the tail is routinely a
   * half-written marker. Without the guard it renders as literal text for a few
   * hundred milliseconds and then vanishes.
   */
  it.each(["<part", "<part k=", `<part k="ghar`])(
    "hides the half-arrived marker %s",
    (tail) => {
      const { loose, ordered } = answerSections(
        `<part k="tafsir">المعنى</part>${tail}`,
        "tafsir",
      );
      expect(loose).not.toContain("<part");
      expect(ordered.map((s) => s.key)).toEqual(["tafsir"]);
    },
  );
});

/**
 * «تُفتح بالنقر إن لم يكن السؤال عنها، وتظهر مباشرة إن سُئل عنها.»
 *
 * The second half of the fold rule, and the half that makes progressive
 * disclosure safe: a reader who asks for the meaning of a word is asking for
 * غريب القرآن, and serving it folded would hide the answer behind a click.
 */
describe("which folds start open", () => {
  it("folds by default", () => {
    const open = openSections("tafsir", "ما تفسير هذه الآية؟");
    expect(open.has("gharib")).toBe(false);
    expect(open.has("fawaid")).toBe(false);
  });

  it.each([
    ["ما معنى كلمة «الحكمة» في الآية؟", "gharib"],
    ["ما فوائد هذه الآية؟", "fawaid"],
  ])("opens the section the question asked for: %s", (question, key) => {
    expect(openSections("tafsir", question).has(key)).toBe(true);
  });

  /*
   * «الأدلة» and «اختلاف العلماء» have no fold to open because they have no
   * section: a proof is written under the claim it proves, and a disagreement
   * under the point it concerns. A reader asking «ما الدليل؟» is already
   * looking at the proofs, beside the sentences they establish.
   */
  it("has no evidence or disagreement fold left to open", () => {
    const keys = sectionsFor("fatwa").map((section) => section.key);
    expect(keys).not.toContain("evidence");
    expect(keys).not.toContain("khilaf");
    expect(openSections("fatwa", "ما الدليل على ذلك؟")).toEqual(new Set());
  });

  /*
   * The router still answers the question — it decides how the answer is
   * *written*, not which fold opens.
   */
  it("still recognises a question about the disagreement itself", () => {
    expect(routeQuestion("ما اختلاف العلماء في الجمع بين الصلاتين؟")
      .asksDisagreement).toBe(true);
  });

  it("never reports an expanded section as opened", () => {
    for (const template of ["tafsir", "fatwa", "hadith-explain"] as const) {
      const open = openSections(template, "ما معنى الدليل والفوائد والخلاف؟");
      for (const key of open) {
        expect(sectionsFor(template).find((s) => s.key === key)?.collapsed).toBe(
          true,
        );
      }
    }
  });
});

describe("the format instruction", () => {
  it("names every section of the routed template, in order", () => {
    const block = answerFormat("hadith-explain");
    const keys = sectionsFor("hadith-explain").map((s) => s.key);
    let cursor = -1;
    for (const key of keys) {
      const at = block.indexOf(`k="${key}"`);
      expect(at, `${key} missing from the instruction`).toBeGreaterThan(-1);
      expect(at, `${key} out of order`).toBeGreaterThan(cursor);
      cursor = at;
    }
  });

  /*
   * The structural half is what makes the arrangement worth the machinery: the
   * verse, the reference and the grading stop being things a model retypes.
   */
  it("asks for a ref and no prose on the structural sections", () => {
    const block = answerFormat("hadith-explain");
    expect(block).toContain('<part k="matn" ref="معرّف المقطع"></part>');
    expect(block).toContain('<part k="meaning">…</part>');
  });

  it("tells the model not to write the headings itself", () => {
    expect(answerFormat("tafsir")).toContain("لا تكتب عنوان القسم داخله");
  });
});

/**
 * The bipolar grade display: «نظام ثنائي واضح ومباشر يعتمد أقسام الدرر السنية
 * الأربعة، لتقليل الحاجز الذهني».
 *
 * Two colours are a presentation decision, not a scholarly one — the grading's
 * own words are always shown beside the colour, because the brief forbids
 * rewording them.
 */
describe("reading a hadith's grading", () => {
  it.each([
    "صحيح",
    "حسن",
    "صحيح لغيره",
    "حسن لغيره",
    "متفق عليه",
    "إسناده صحيح",
  ])("reads %s as sound", (grade) => {
    expect(gradeTone(grade)).toBe("sound");
  });

  it.each([
    "ضعيف",
    "ضعيف جدًا",
    "موضوع",
    "لا يصح",
    "لا أصل له",
    "منكر",
    "إسناده ضعيف",
    "غير ثابت",
  ])("reads %s as weak", (grade) => {
    expect(gradeTone(grade)).toBe("weak");
  });

  /*
   * The bug this guards: «غير صحيح» contains «صحيح», so any order of plain
   * substring tests paints a weak hadith green. No amount of growing the term
   * lists fixes it — every positive grading has a negated form — so the
   * negation is matched as a negation.
   */
  it.each([
    "غير صحيح",
    "ليس بصحيح",
    "لا يصح",
    "لم يثبت",
    "غير ثابت",
    "ليس بحسن",
  ])("does not read the negated grading %s as sound", (grade) => {
    expect(gradeTone(grade)).toBe("weak");
  });

  /*
   * `unknown` is a real outcome. The encyclopedias carry gradings this list
   * does not anticipate, and colouring one by guesswork would assert something
   * the data did not say.
   */
  it.each(["", null, undefined, "قال النووي: فيه كلام"])(
    "leaves %s uncoloured rather than guessing",
    (grade) => {
      expect(gradeTone(grade)).toBe("unknown");
    },
  );
});

/**
 * The language gate must judge what the model wrote, not how it was marked up.
 *
 * The bug this guards was total for two templates: `hadith-explain` and
 * `hadith-card` both open with structural sections, whose markers are pure
 * Latin, so the first 180 characters of the stream contained no Arabic at all.
 * Every hadith answer to an Arabic question was judged English, discarded, and
 * regenerated — and the regeneration then failed its own API call.
 */
describe("the language gate reads prose, not markup", () => {
  const hadithOpening =
    '<part k="matn" ref="hadeethenc-4560#0"></part>\n' +
    '<part k="reference" ref="hadeethenc-4560#0"></part>\n' +
    '<part k="grade" ref="hadeethenc-4560#0"></part>\n' +
    '<part k="meaning">يُبيّن الحديث أن الأعمال معتبرة بالنيات';

  it("sees the markers as English before stripping", () => {
    // the defect, asserted so the fix cannot be quietly reverted
    expect(detectLanguage(hadithOpening.slice(0, 140))).toBe("en");
  });

  it("reads the same answer as Arabic once stripped", () => {
    expect(detectLanguage(prose(hadithOpening))).toBe("ar");
  });

  it("strips a citation id, which is Latin and not the model's prose", () => {
    const answer =
      'حديث صحيح متفق عليه <citation ids="web-islamqa-info-1mbg1ub#5"></citation>';
    expect(prose(answer)).not.toContain("islamqa");
    expect(detectLanguage(prose(answer))).toBe("ar");
  });

  it("strips a tag that is still arriving", () => {
    expect(prose('نصٌّ عربيٌّ كافٍ لتقرير اللغة <part k="ref')).not.toContain(
      "<part",
    );
  });
});

/**
 * The structural sections are built from the source data, so they are the last
 * thing in an answer that should be marked unsourced.
 *
 * Three of them in a row form one ~140-character paragraph with no citation,
 * which cleared the substantive threshold and earned a "no source" marker.
 */
describe("structural sections are structure, not claims", () => {
  it("does not mark a run of structural markers as uncited", () => {
    const answer =
      '<part k="verdict">الحديث صحيح <citation ids="hadeethenc-4560#0"></citation></part>\n\n' +
      '<part k="matn" ref="hadeethenc-4560#0"></part>\n' +
      '<part k="reference" ref="hadeethenc-4560#0"></part>\n' +
      '<part k="grade" ref="hadeethenc-4560#0"></part>';
    expect(markUncitedParagraphs(answer)).not.toContain("<uncited />");
  });

  it("still marks a real uncited passage", () => {
    const answer =
      '<part k="verdict">الحديث صحيح <citation ids="a#1"></citation></part>\n\n' +
      "<part k=\"meaning\">" +
      "هذا كلام مطوّل يقرّر حكمًا شرعيًّا ويطيل فيه القول دون أن يسنده إلى أي مصدر معتبر، وهو بالضبط ما يحتاج القارئ أن يعرف أنه غير موثَّق." +
      "</part>";
    expect(markUncitedParagraphs(answer)).toContain("<uncited />");
  });
});

/**
 * A verse card is the most completely sourced answer the system produces: two
 * section markers, no prose, every word of it rendered from the retrieved
 * chunk. Counting only `<citation>` tags banners it as citing nothing.
 */
describe("a section ref is an attribution", () => {
  const card =
    '<part k="ayah" ref="quranenc-16-125#0"></part>\n' +
    '<part k="reference" ref="quranenc-16-125#0"></part>';

  it("does not call a structural answer unattributed", () => {
    expect(citesNothing(card)).toBe(false);
  });

  it("still catches an answer that attributes nothing at all", () => {
    expect(citesNothing('<part k="ruling">يجوز ذلك</part>')).toBe(true);
  });

  it("ignores a ref with no value", () => {
    expect(citesNothing('<part k="ayah" ref=""></part>')).toBe(true);
  });
});

/**
 * Evidence as data: «عند وجود دليلين فأكثر تُعرض الأدلة في جدول بدل الأقسام،
 * في أي مجال وليس في الفقه وحده» and «القرآن ← السنة ← الإجماع ← القياس».
 *
 * Both are claims about structure. The ordering in particular is scholarship
 * rather than presentation — putting qiyās above a verse misrepresents how the
 * ruling was reached — so it is asserted here rather than asked for.
 */
describe("reading the proofs", () => {
  const body =
    '<ev t="القياس" by="بعض الفقهاء" why="قياسًا على كذا" src="كتاب">قياس</ev>\n' +
    '<ev t="السنة" by="جمهور العلماء" why="فعله ﷺ دليل الجواز" src="البخاري (1106)" ids="hadeethenc-4560#0">«كان النبيُّ ﷺ يَجمَعُ»</ev>\n' +
    '<ev t="القرآن" by="عامة أهل العلم" why="نفى الله الحرج" src="النساء ١٠١" ids="quranenc-4-101#0">﴿فَلَيْسَ عَلَيْكُمْ جُنَاحٌ﴾</ev>\n' +
    '<ev t="الإجماع" by="حكاه ابن المنذر" why="الإجماع حجة" src="الإجماع">أجمع أهل العلم</ev>';

  it("orders by the evidentiary hierarchy, not by what the model wrote first", () => {
    expect(parseProofs(body).map((p) => p.kind)).toEqual([
      "quran",
      "sunnah",
      "ijma",
      "qiyas",
    ]);
  });

  it("reads every field of a proof", () => {
    const sunnah = parseProofs(body).find((p) => p.kind === "sunnah");
    expect(sunnah?.by).toBe("جمهور العلماء");
    expect(sunnah?.why).toBe("فعله ﷺ دليل الجواز");
    expect(sunnah?.source).toBe("البخاري (1106)");
    expect(sunnah?.ids).toEqual(["hadeethenc-4560#0"]);
    expect(sunnah?.text).toContain("يَجمَعُ");
  });

  it("keeps the model's order within one type", () => {
    const two =
      '<ev t="السنة" src="أ">الأول</ev><ev t="السنة" src="ب">الثاني</ev>';
    expect(parseProofs(two).map((p) => p.source)).toEqual(["أ", "ب"]);
  });

  /*
   * The row colour and the sort position both encode which of the four a proof
   * is, so a proof placed by guesswork would assert a position in the hierarchy
   * that nothing said.
   */
  it("drops a proof whose type it cannot read", () => {
    expect(parseProofs('<ev t="رأيي" src="x">نص</ev>')).toEqual([]);
    expect(parseProofs("<ev>نص بلا نوع</ev>")).toEqual([]);
  });

  it("drops a proof with no text", () => {
    expect(parseProofs('<ev t="السنة" src="x"></ev>')).toEqual([]);
  });

  it.each([
    ["an unclosed marker", '<ev t="السنة" src="x">نص'],
    ["an unquoted type", "<ev t=السنة src=x>نص</ev>"],
    ["an English key", '<ev t="sunnah" src="x">نص</ev>'],
    ["another attribute name", '<ev type="السنة" source="x">نص</ev>'],
  ])("repairs %s", (_label, text) => {
    const proofs = parseProofs(text);
    expect(proofs).toHaveLength(1);
    expect(proofs[0]?.kind).toBe("sunnah");
  });

  it("splits several ids on a single proof", () => {
    const proofs = parseProofs('<ev t="السنة" ids="a#1, b#2">نص</ev>');
    expect(proofs[0]?.ids).toEqual(["a#1", "b#2"]);
  });

  /*
   * «دليلان على الأقل، وإلا تُعرض الأدلة بالترتيب» — a table of one row claims
   * a comparison that is not there.
   */
  it("tabulates at two proofs and not at one", () => {
    expect(asTable(parseProofs('<ev t="السنة" src="x">نص</ev>'))).toBe(false);
    expect(asTable(parseProofs(body))).toBe(true);
  });

  /*
   * «في أي مجال وليس في الفقه وحده». An ʿaqīda answer or a reply to a shubha
   * argues from proofs exactly as a ruling does, and those render as `general`.
   */
  /*
   * «في أي مجال وليس في الفقه وحده» — the proofs reach a general answer too,
   * now by being written into its prose rather than by a section of its own.
   */
  it("is asked for outside fiqh as well", () => {
    for (const template of ["fatwa", "general"] as const) {
      const briefs = sectionsFor(template)
        .map((section) => section.brief)
        .join("\n");
      expect(briefs, `${template} never asks for <ev>`).toContain("<ev");
    }
  });

  /* An `<ev ids>` row attributes its passage the way a citation tag does. */
  it("counts an evidence row as an attribution", () => {
    expect(
      citesNothing('<part k="evidence"><ev t="السنة" ids="a#1">نص</ev></part>'),
    ).toBe(false);
    expect(
      citesNothing('<part k="evidence"><ev t="السنة">نص</ev></part>'),
    ).toBe(true);
  });
});

/**
 * The root a word's statistics are keyed on.
 *
 * `analyze_word` returns `root: null` for every word tested, and states the
 * root in its ṣarf field instead — «مِنْ مَادَّةِ: (أله)». Reading it from
 * there is reading the centre's own stated مادة, not deriving a root
 * ourselves; without it the إحصاءات الجذر block the specification names would
 * never appear at all.
 */
describe("reading a word's root from the ṣarf", () => {
  it.each([
    ["{اللَّهُ}: اسْمٌ، جَامِدٌ، مِنْ مَادَّةِ: (أله).", "أله"],
    ["{الصَّمَدُ}: اسْمٌ، ثُلَاثِيٌّ، مِنْ مَادَّةِ: (صمد).", "صمد"],
    ["من مادة: (عون)", "عون"],
  ])("reads %s", (sarf, root) => {
    expect(rootFromSarf(sarf)).toBe(root);
  });

  /*
   * The bug this guards: «مَادَّةِ» carries a fatḥa, a shadda and a kasra, so a
   * pattern written against the undiacriticised word matched nothing — and the
   * block silently never rendered.
   */
  it("is not defeated by the diacritics on «مادة» itself", () => {
    expect(rootFromSarf("مِنْ مَادَّةِ: (رحم)")).toBe("رحم");
  });

  /* The capture comes from inside the parentheses, so the root keeps its hamza. */
  it("leaves the root's own orthography alone", () => {
    expect(rootFromSarf("مِنْ مَادَّةِ: (أمر)")).toBe("أمر");
  });

  it.each([null, undefined, "", "{يَا}: حَرْفٌ مَبْنِيٌّ"])(
    "returns null when no مادة is stated (%s)",
    (sarf) => {
      expect(rootFromSarf(sarf)).toBeNull();
    },
  );
});

/**
 * The third axis: «التفسير حسب مستوى المستخدم — تختلف المصادر بحسب مستوى
 * السائل».
 *
 * Not the depth preference under another name. Depth is a length control,
 * written as one; this one changes *which sources are read*, which makes it a
 * retrieval decision before it is a presentation one.
 */
describe("the reader's level", () => {
  /*
   * The specification's §3.3 table, verbatim: التفسير الميسر and المختصر for
   * the non-specialist, السعدي البغوي ابن كثير الطبري «مع ذكر الطبعة» for the
   * specialist.
   */
  it("reads the simplified editions for a general reader", () => {
    expect(tafsirEditionsFor("general")).toEqual(["moyassar", "mukhtasar_ar"]);
  });

  it("reads the classical editions for a specialist", () => {
    expect(tafsirEditionsFor("specialist")).toEqual([
      "saadi",
      "baghawy",
      "katheer",
      "tabary",
    ]);
  });

  /*
   * The two sets are disjoint, which is the point: this is a different library,
   * not a longer version of the same one.
   */
  it("serves two different libraries, not one with more of it", () => {
    const general = new Set(tafsirEditionsFor("general"));
    for (const edition of tafsirEditionsFor("specialist")) {
      expect(general.has(edition)).toBe(false);
    }
  });

  /*
   * A missing preference must land on the general reader. A specialist served
   * plain commentary is under-served; a general reader served الطبري is not
   * served at all — and that was the shipped behaviour before this axis
   * existed.
   */
  it("falls back to the general reader, never the specialist", () => {
    expect(tafsirEditionsFor(undefined)).toEqual(tafsirEditionsFor("general"));
    expect(DEFAULT_EXPERTISE).toBe("general");
  });

  it("states the register, and restates what it does not relax", () => {
    const general = withExpertise("BASE", "general");
    expect(general).toContain("الفصحى البيضاء");
    // simplifying the wording is not licence to drop a grading
    expect(general).toContain("درجته");
    expect(general).toContain("<reader_level>");

    const specialist = withExpertise("BASE", "specialist");
    expect(specialist).toContain("طبعته");
    expect(specialist).toContain("تعدّد الأحكام");
  });

  it("always states a level, since there is no neutral reader", () => {
    expect(withExpertise("BASE", undefined)).toContain("<reader_level>");
  });

  /*
   * That the model cannot choose editions is enforced by types, not asserted
   * here: `tafsir_get` exposes no `editions` field and `fetchTafsir` takes
   * `sources` as a required parameter, so there is no default left for anyone
   * to inherit by accident. Asserting it would mean importing `tools.ts`,
   * which reaches `@/env` and needs server variables at import time — and
   * keeping this suite runnable without a configured environment is worth more
   * than restating what the compiler already refuses to let through.
   */
});

/**
 * The seventh template: «قالب لبيان معنى أي لفظ».
 *
 * Its placement is the whole design. A meaning question about a word that
 * already belongs to a domain belongs to that domain — the brief's case 7 is
 * ʿaqīda, a word tied to an āya is غريب القرآن — so the lexical rule sits below
 * all of them and catches the word that is nobody else's subject.
 */
describe("the Arabic-language template", () => {
  it.each([
    "ما معنى التقوى؟",
    "ما معنى الإحسان؟",
    "ما معنى كلمة الصدق؟",
    "ما معنى الصبر في اللغة والاصطلاح؟",
    "ما الفرق بين الرحمن والرحيم؟",
  ])("routes a bare lexical question: %s", (question) => {
    const routing = routeQuestion(question);
    expect(routing.intent).toBe("language");
    expect(routing.template).toBe("arabic");
  });

  /*
   * The exclusions are the other rules, not a lookahead. Each of these was a
   * regression the first time the rule was placed above them.
   */
  it.each([
    ["ما معنى التوحيد لشخص لم يسمع بالمصطلح من قبل؟", "aqida"],
    ["ما معنى كلمة «أبّا» في القرآن؟", "tafsir"],
    ["ما معنى قوله تعالى: وجادلهم بالتي هي أحسن؟", "tafsir"],
    ["ما معنى مصطلح الإحصان؟", "terminology"],
  ])("leaves %s to %s", (question, intent) => {
    expect(routeQuestion(question).intent).toBe(intent);
  });

  /* The specification's §6: a base for every word, then the two additions. */
  it("has the base before the additions, and never folds the base", () => {
    const keys = sectionsFor("arabic").map((s) => s.key);
    expect(keys).toEqual([
      "lughawi",
      "istilahi",
      "related",
      "quran_usage",
      "hadith_usage",
    ]);
    for (const section of sectionsFor("arabic").slice(0, 3)) {
      expect(section.collapsed).toBe(false);
    }
  });

  /*
   * The counts are the concordance's. A model asked to repeat «ورد الجذر وقي
   * ٢٥٨ مرة» in prose is one digit away from being wrong about something a
   * reader can check in a minute.
   */
  it("builds the Qurʾānic usage from data, not from prose", () => {
    const usage = sectionsFor("arabic").find((s) => s.key === "quran_usage");
    expect(usage?.kind).toBe("usage");
    expect(usage?.label).toBeNull();
    expect(usage?.brief).toContain("ref");
  });
});

/**
 * The v1.10 template revision, 6 October 2026.
 *
 * Asserted because the order is the part a later edit would quietly undo: the
 * commentary leads a tafsīr answer and the glossary folds beneath it, where the
 * earlier version opened on the glossary.
 */
describe("the v1.10 section order", () => {
  it("leads a commentary with the commentary", () => {
    expect(sectionsFor("tafsir").map((s) => s.key)).toEqual([
      "ayah",
      "reference",
      "tafsir",
      "gharib",
      "fawaid",
    ]);
    const spec = sectionsFor("tafsir");
    expect(spec.find((s) => s.key === "tafsir")?.collapsed).toBe(false);
    expect(spec.find((s) => s.key === "gharib")?.collapsed).toBe(true);
  });

  it("splits a fiqh ruling into the preferred one and its detail", () => {
    const keys = sectionsFor("fatwa").map((s) => s.key);
    expect(keys.slice(0, 3)).toEqual(["question", "ruling", "detail"]);
    // the proof and the disagreement live inside those two, not after them
    expect(keys).toEqual(["question", "ruling", "detail", "authority", "sources"]);
  });

  it("leads a hadith with its grading, however the question was framed", () => {
    for (const template of ["hadith-card", "hadith-explain"] as const) {
      const grade = sectionsFor(template).find((s) => s.key === "grade");
      expect(grade?.label).toBe("درجة الحديث");
      expect(grade?.trust).toBe(true);
    }
  });

  /* The trust marks v1.10 places, and only those. */
  it("marks exactly the sections that carry a source's own words", () => {
    const marked = (
      ["tafsir", "fatwa", "hadith-card", "hadith-explain"] as const
    ).flatMap((t) =>
      sectionsFor(t)
        .filter((s) => s.trust)
        .map((s) => s.label),
    );
    expect(new Set(marked)).toEqual(
      new Set(["المعنى الإجمالي", "الحكم الراجح", "الجهة المفتية", "المصدر", "درجة الحديث"]),
    );
  });
});
