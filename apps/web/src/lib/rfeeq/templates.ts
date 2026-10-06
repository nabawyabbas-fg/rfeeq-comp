import type { RfeeqRouting, RfeeqTemplate } from "./intent";

import { EVIDENCE_BRIEF } from "./evidence";
import { normalise, stems } from "./normalise";

/**
 * What an answer is made of, per template.
 *
 * The MVP template specification (30 September 2026) defines each subject's
 * answer as an **ordered list of named sections with a declared collapse
 * state** — and states the governing rule twice: «مهمة البطاقة أن تَعُدّ
 * وتُلخّص ثم تفتح عند الطلب؛ فالبطاقة التي تعرض كل ما لديها لا تُقرأ». A
 * section is closed when the question was not about it and **open when it
 * was**: «تُفتح بالنقر إن لم يكن السؤال عنها، وتظهر مباشرة إن سُئل عنها».
 *
 * None of that is expressible as a prompt instruction, which is why this file
 * exists. Asking a model to "start with the shortest answer and fold the rest"
 * produces that shape *sometimes*; the specification needs it every time, in a
 * fixed order, with the fold state decided by the template rather than by the
 * run. So the order and the collapse state live here, the model is asked only
 * to fill named slots, and the renderer composes them.
 *
 * Two kinds of section, and the difference is the point:
 *
 * - **prose** — the model writes it. Explanation, benefits, a ruling's wording.
 * - **structural** — the renderer builds it from the retrieved chunk the model
 *   names in `ref`: the verse itself, the reference row, the grading. These are
 *   not the model's to phrase. A verse rendered from `metadata` is verbatim by
 *   construction, and a grading copied out of a field cannot be reworded, which
 *   is the brief's hadith rule and its تمييز كلام المفسر عن النص both turned
 *   from conventions into facts about the renderer.
 */

/** How a section's content is produced. */
export type SectionKind =
  | "prose" // the model writes it
  | "scripture" // the renderer sets the retrieved text at reading size
  | "reference" // the renderer builds the reference row from metadata
  | "grade" // the renderer renders the grading, in the bipolar colours
  | "evidence" // the renderer orders, colours and tabulates the proofs
  | "usage"; // the renderer orders, colours and tabulates the proofs

export interface SectionSpec {
  /** The stable key the model emits and the renderer switches on. */
  key: string;
  /** The Arabic heading, or null where the section carries none. */
  label: string | null;
  /** Whether it renders folded when the question did not ask for it. */
  collapsed: boolean;
  kind: SectionKind;
  /**
   * Question terms that force a collapsed section open.
   *
   * The specification's rule, made operational: «ما معنى كلمة …؟» opens
   * غريب القرآن, «ما فوائد الآية؟» opens الفوائد العملية. Written as bare
   * Arabic stems — `stems()` folds them, so spell them normally.
   */
  opensOn?: string[];
  /** What the model should put here, stated to the model. */
  brief: string;
  /**
   * Marks the section as carrying material lifted from a source rather than
   * composed — a grading, an issuing body, a named commentary.
   *
   * Rendered as a «مصدر موثّق» tag beside the heading. v1.10 puts it on
   * المعنى الإجمالي, درجة الحديث, الحكم الراجح, الجهة المفتية and المصدر: the
   * places where what is shown is the source's own words, so the reader can
   * see at a glance which parts of an answer were written and which were
   * carried.
   */
  trust?: boolean;
  /** What the trust tag names as the provenance, when there is one to name. */
  trustSource?: string;
}

/**
 * The sections of each template, in the order they render.
 *
 * Order is not a preference. The fiqh rule is «يبدأ الجواب الفقهي دائمًا
 * بالحكم واضحًا، ثم يأتي التفصيل», and an answer that explains for two
 * paragraphs before stating the ruling has failed the template even if every
 * sentence in it is true and sourced.
 */
const SECTIONS: Record<RfeeqTemplate, SectionSpec[]> = {
  /* ── a word's meaning ──────────────────────────────────────────────────── */
  arabic: [
    {
      key: "lughawi",
      label: "المعنى اللغوي",
      collapsed: false,
      kind: "prose",
      brief:
        "أصل اللفظ في كلام العرب ومادته، من معجم معتمد منسوبًا إليه، لا من استنباطك.",
    },
    {
      key: "istilahi",
      label: "المعنى الاصطلاحي",
      collapsed: false,
      kind: "prose",
      brief:
        "ما استقرّ عليه أهل الاصطلاح، منسوبًا إلى من حدّه. وإن اختلف الحدّ باختلاف الفن — أصولًا وفقهًا وحديثًا — فبيّن ذلك ولا تدمج الحدود.",
    },
    {
      key: "related",
      label: "الألفاظ ذات الصلة",
      collapsed: false,
      kind: "prose",
      brief:
        "الألفاظ القريبة منه وما يفترق به عنها، كلٌّ بمصدره. واحذف القسم إن لم تجد في المصادر ما يُقابله.",
    },
    {
      key: "quran_usage",
      label: null,
      collapsed: false,
      kind: "usage",
      brief:
        "استدعِ quran_usage باللفظ، ثم ضع معرّف المقطع في ref واترك القسم فارغًا؛ الجذرُ والعددُ وجدولُ الصيغ تُبنى من البيانات. واحذف القسم إن لم يرد اللفظ في القرآن.",
    },
    {
      key: "hadith_usage",
      label: "الاستعمال الحديثي",
      collapsed: false,
      kind: "prose",
      brief:
        "مواضع اللفظ في السنة: حديث أو حديثان يتبيّن بهما استعماله، بدرجته ومصدره. واحذف القسم إن لم تجد.",
    },
  ],

  /* ── a verse, as the answer's subject ────────────────────────────────── */
  aya: [
    {
      key: "ayah",
      label: null,
      collapsed: false,
      kind: "scripture",
      brief:
        "معرّف مقطع الآية في ref، ولا تكتب نص الآية بنفسك. وإن كان السؤال عن " +
        "سورة كاملة آياتُها أقلُّ من عشر، فاذكر **معرّفات آياتها كلها** في ref " +
        "مفصولةً بفواصل، بترتيب المصحف — فالسورة القصيرة تُقرأ كاملة.",
    },
    {
      key: "reference",
      label: null,
      collapsed: false,
      kind: "reference",
      brief: "معرّف المقطع نفسه في ref؛ يُبنى السطر المرجعي تلقائيًا.",
    },
    {
      key: "context",
      label: "سياق السورة",
      collapsed: false,
      kind: "prose",
      brief:
        "موضع الآية من سورتها ومقصد السورة، من المصادر المعتمدة لا من معرفتك.",
    },
  ],

  /* ── a verse explained ───────────────────────────────────────────────────
   * v1.10 reorders this one: the commentary now comes **first**, with غريب
   * القرآن and الفوائد folded beneath it. The earlier order opened on the
   * glossary, which put the least-asked-for part of a commentary answer at the
   * top of it.
   */
  tafsir: [
    {
      key: "ayah",
      label: null,
      collapsed: false,
      kind: "scripture",
      brief: "معرّف مقطع الآية في ref، ولا تكتب نص الآية بنفسك.",
    },
    {
      key: "reference",
      label: null,
      collapsed: false,
      kind: "reference",
      brief:
        "المعرّفات نفسها التي وضعتها في قسم الآية، بالفواصل نفسها — ليعرف " +
        "السطر المرجعي كم آية عُرضت فيذكر مداها لا أولها فقط.",
    },
    {
      key: "tafsir",
      /*
       * «المعنى الإجمالي» rather than the edition's name.
       *
       * The heading names what the section *is* — the sense of the āya — not
       * which book it came from, and it has to, now that the answer is written
       * from one edition while the rest wait in the pane. A reader opening
       * علوم الآية finds التفسير الميسر، المختصر، السعدي، ابن كثير، الطبري side
       * by side; the answer gives them the meaning first, attributed, and the
       * comparison is a tap away.
       */
      label: "المعنى الإجمالي",
      collapsed: false,
      kind: "prose",
      trust: true,
      trustSource: "مركز تفسير للدراسات القرآنية",
      brief:
        "معنى الآية مباشرةً. **ابدأ بالمعنى نفسه، لا بتمهيدٍ يسمّي الكتاب** — " +
        "لا تكتب «جاء في التفسير الميسر:» ولا نحوها؛ فاسم المصدر مذكورٌ في " +
        "وسم «مصدر موثّق» فوق القسم وفي التوثيق، وإعادتُه في أول السطر تؤخّر " +
        "الجواب بسطرٍ لا يضيف شيئًا. وميّز كلام المفسّر عن نص الآية تمييزًا " +
        "ظاهرًا، وإن اختلف المفسّرون فاعرض الأقوال منسوبةً دون ترجيح.",
    },
    {
      key: "gharib",
      label: "غريب القرآن",
      collapsed: true,
      kind: "prose",
      opensOn: ["معنى", "معاني", "كلمه", "غريب", "المراد", "مفردات"],
      brief:
        "الكلمات التي تحتاج بيانًا، كل كلمة بين «» ثم معناها من المصادر، في نقاط. واحذف القسم إن لم يكن في الآية غريب.",
    },
    {
      key: "fawaid",
      label: "من فوائد الآيات",
      collapsed: true,
      kind: "prose",
      opensOn: ["فوائد", "فائده", "دروس", "نستفيد", "عبره", "مقاصد"],
      brief: "ما تُفيده الآية عملًا، في نقاط قصيرة، كل نقطة بمصدرها.",
    },
  ],

  /* ── a hadith's authenticity ─────────────────────────────────────────────
   * `verdict` is ours, not v1.10's, and it is kept on purpose: the prototype
   * models a hadith that *is* in the encyclopedia, while the brief's case 6
   * requires the system to say plainly that no matching evidence was found.
   * Without a prose slot this template could not answer that question at all.
   */
  "hadith-card": [
    {
      key: "verdict",
      label: null,
      collapsed: false,
      kind: "prose",
      brief:
        "جواب السؤال في سطر أو سطرين: هل يثبت أم لا، بلفظ المصدر لا بلفظك. وإن لم يثبت فقل ذلك صراحةً، واذكر الصحيح في معناه إن وُجد.",
    },
    {
      key: "matn",
      label: null,
      collapsed: false,
      kind: "scripture",
      brief: "معرّف مقطع الحديث في ref، ولا تكتب المتن بنفسك.",
    },
    {
      key: "reference",
      label: null,
      collapsed: false,
      kind: "reference",
      brief: "معرّف المقطع نفسه في ref.",
    },
    {
      key: "grade",
      label: "درجة الحديث",
      collapsed: false,
      kind: "grade",
      trust: true,
      trustSource: "موسوعة الأحاديث النبوية",
      brief: "معرّف المقطع نفسه في ref؛ تُعرض الدرجة بنصّها من المصدر.",
    },
    {
      key: "graders",
      label: "أحكام المحدّثين",
      collapsed: true,
      kind: "prose",
      opensOn: ["من حكم عليه", "احكام المحدثين", "من صححه", "من ضعفه"],
      brief:
        "إن تعدّدت أحكام المحدّثين على الحديث فاذكرها: كل حكم باسم من قال به ومصدره. واحذف القسم إن لم يكن في المصادر إلا حكم واحد.",
    },
  ],

  /* ── a hadith explained ──────────────────────────────────────────────────
   * v1.10 folds غريب الحديث and الفوائد, which the earlier version showed
   * expanded, and leads with درجة الحديث: a reader asking for the meaning of a
   * report still needs to know first whether it is established.
   */
  "hadith-explain": [
    {
      key: "matn",
      label: null,
      collapsed: false,
      kind: "scripture",
      brief: "معرّف مقطع الحديث في ref، ولا تكتب المتن بنفسك.",
    },
    {
      key: "reference",
      label: null,
      collapsed: false,
      kind: "reference",
      brief: "معرّف المقطع نفسه في ref.",
    },
    {
      key: "grade",
      label: "درجة الحديث",
      collapsed: false,
      kind: "grade",
      trust: true,
      trustSource: "موسوعة الأحاديث النبوية",
      brief: "معرّف المقطع نفسه في ref.",
    },
    {
      key: "graders",
      label: "أحكام المحدّثين",
      collapsed: true,
      kind: "prose",
      opensOn: ["من حكم عليه", "احكام المحدثين", "من صححه", "من ضعفه"],
      brief:
        "إن تعدّدت أحكام المحدّثين فاذكرها، كل حكم باسم من قال به ومصدره. واحذف القسم إن لم يكن إلا حكم واحد.",
    },
    {
      key: "meaning",
      label: "المعنى المبسّط",
      collapsed: false,
      kind: "prose",
      brief:
        "معنى الحديث بالفصحى الميسّرة، من شرح معتمد منسوبًا إليه، لا من استنباطك.",
    },
    {
      key: "gharib",
      label: "غريب الحديث",
      collapsed: true,
      kind: "prose",
      opensOn: ["معنى", "كلمه", "غريب", "المراد"],
      brief:
        "الكلمات التي تحتاج بيانًا، كل كلمة بين «» ثم معناها، في نقاط. واحذف القسم إن لم يكن في المتن غريب.",
    },
    {
      key: "fawaid",
      label: "الفوائد العملية",
      collapsed: true,
      kind: "prose",
      opensOn: ["فوائد", "فائده", "دروس", "نستفيد"],
      brief: "ما يُفيده الحديث عملًا، في نقاط قصيرة بمصادرها.",
    },
    {
      key: "translation",
      label: "ترجمة الحديث",
      collapsed: true,
      kind: "prose",
      opensOn: ["ترجمه", "بالانجليزيه", "english"],
      brief:
        "الترجمة المعتمدة للحديث من موسوعة الحديث إن استرجعتها. ولا تترجم المتن بنفسك: احذف القسم إن لم تكن الترجمة في المقاطع.",
    },
  ],

  /* ── a ruling, as a source states it ─────────────────────────────────────
   * v1.10 splits the ruling in two — الحكم الراجح then الحكم التفصيلي — and
   * folds اختلاف العلماء beneath them. «يبدأ الجواب الفقهي دائمًا بالحكم
   * واضحًا، ثم يأتي التفصيل», now literally two slots.
   */
  fatwa: [
    {
      key: "question",
      label: "السؤال كما فهمناه",
      collapsed: false,
      kind: "prose",
      brief:
        "ما فهمتَه من السؤال في سطر، وإن كان فيه أكثر من مسألة فعدّدها. واحذف القسم إن كان السؤال مسألةً واحدة بيّنة.",
    },
    {
      key: "ruling",
      label: "الحكم الراجح",
      collapsed: false,
      kind: "prose",
      trust: true,
      brief:
        "الحكم أولًا وبوضوح، في سطر أو سطرين، بلفظ المصدر ومنسوبًا إليه. وإن " +
        "كانت المسألة خلافية فابدأ بما رجّحه المصدر منسوبًا إليه، لا بترجيحك. " +
        "وما كان من دليلٍ يدلّ على الحكم في جملته فضعه هنا بوسم <ev …> عقب " +
        "الحكم، وما خصّ شرطًا بعينه فموضعه تحت ذلك الشرط.",
    },
    {
      key: "detail",
      label: "الحكم التفصيلي",
      collapsed: false,
      kind: "prose",
      brief:
        "شروط الحكم وقيوده وما يتغيّر به، في نقاط قصيرة بمصادرها.\n  " +
        "**ولكل نقطة دليلها وخلافها تحتها**: اكتب عقب كل نقطة وسمَ <ev …> " +
        "بدليلها، وإن كان فيها خلاف معتبر فاكتبه بعده مصدَّرًا بـ" +
        "«**اختلاف العلماء:**». لا يوجد قسم مستقل للأدلة ولا للخلاف؛ الدليل " +
        "يُقرأ مع ما يدلّ عليه، لا في قائمة أسفل الجواب يجمع القارئ بينها " +
        "وبين مواضعها بنفسه.\n  " +
        EVIDENCE_BRIEF,
    },
    {
      key: "authority",
      label: "الجهة المفتية",
      collapsed: false,
      kind: "prose",
      trust: true,
      brief:
        "الجهة أو العالم الذي صدر عنه الحكم، بالعبارة التي ورد بها في المصدر. واحذف القسم إن كان الحكم منقولًا من كتاب لا من جهة إفتاء.",
    },
    {
      key: "sources",
      label: "المصدر",
      collapsed: false,
      kind: "prose",
      trust: true,
      brief: "الكتاب أو الموضع الذي نُقل عنه، كما ورد في المصدر.",
    },
  ],

  /* ── everything else ──────────────────────────────────────────────────── */
  general: [
    {
      key: "answer",
      label: null,
      collapsed: false,
      kind: "prose",
      brief:
        "الجواب، مبنيًّا على المقاطع المسترجعة ومنسوبًا إليها. وضع دليل كل " +
        "جملة تحتها مباشرةً بوسم <ev …>، لا في قائمة أدلة أسفل الجواب.\n  " +
        EVIDENCE_BRIEF,
    },
    /*
     * «في أي مجال وليس في الفقه وحده» — the specification is explicit that the
     * evidence template is not the fiqh template's property.
     */
  ],
};

export const sectionsFor = (template: RfeeqTemplate): SectionSpec[] =>
  SECTIONS[template];

/** Looks a section up by key within a template. */
export const sectionSpec = (template: RfeeqTemplate, key: string) =>
  sectionsFor(template).find((section) => section.key === key) ?? null;

/* ---------- which folds start open ---------- */

const openers = new Map<string, RegExp>();

const opensFor = (spec: SectionSpec) => {
  if (!spec.opensOn) return null;
  const cached = openers.get(spec.key);
  if (cached) return cached;
  const pattern = stems(spec.opensOn);
  openers.set(spec.key, pattern);
  return pattern;
};

/**
 * The collapsed sections this question asks to have open.
 *
 * The other half of the specification's fold rule. A reader who asks «ما معنى
 * كلمة الصمد؟» is asking for غريب القرآن, and serving it folded would hide the
 * answer behind a click — which is the one way progressive disclosure becomes
 * worse than no disclosure.
 *
 * `asksDisagreement` is reused rather than re-detected: the intent router
 * already decides whether the question is about the khilāf itself, and the
 * specification's rule for that case is the same one — «وإن سُئل عن الخلاف
 * مباشرة، يُعرض الجدول في الشاشة الرئيسية».
 */
export const openSections = (
  template: RfeeqTemplate,
  question: string,
  routing?: RfeeqRouting | null,
): Set<string> => {
  const text = normalise(question);
  const open = new Set<string>();

  for (const spec of sectionsFor(template)) {
    if (!spec.collapsed) continue;
    if (spec.key === "khilaf" && routing?.asksDisagreement) {
      open.add(spec.key);
      continue;
    }
    const pattern = opensFor(spec);
    if (pattern?.test(text)) open.add(spec.key);
  }

  return open;
};

/* ---------- the instruction ---------- */

/**
 * The format block for one template, addressed to the model.
 *
 * Written as a numbered list of slots rather than as a description of a layout,
 * because the model's job here is narrow and worth stating narrowly: fill these
 * keys, in this order, and nothing else. Headings are not its concern — the
 * renderer supplies them from `label`, so a model writing its own would
 * duplicate them.
 *
 * Structural sections ask for a chunk id and no prose. That is the part that
 * makes the whole arrangement worth it: the verse, the reference and the
 * grading stop being things a model retypes.
 */
export const answerFormat = (template: RfeeqTemplate) => {
  const specs = sectionsFor(template);

  const lines = specs
    .map((spec, index) => {
      const heading = spec.label ? ` (${spec.label})` : "";
      const structural = spec.kind !== "prose";
      const shape = structural
        ? `<part k="${spec.key}" ref="معرّف المقطع"></part>`
        : `<part k="${spec.key}">…</part>`;
      return `${index + 1}. ${shape}${heading} — ${spec.brief}`;
    })
    .join("\n");

  return `\n\n<answer_format>
اكتب الإجابة أقسامًا مُسمّاة بهذا الترتيب ولا غيره، كل قسم بين وسمين:

${lines}

ضوابط الشكل:
- لا تكتب عنوان القسم داخله؛ العنوان يُعرض تلقائيًا من مفتاحه.
- لا تضف قسمًا ليس في القائمة، ولا تُغيّر ترتيب الأقسام.
- إن لم تجد في المصادر مادةً لقسم فاحذفه بكامله، ولا تملأه من معرفتك ولا تكتب فيه أنك لم تجد شيئًا.
- الأقسام التي يُطلب فيها معرّف المقطع (ref) يبنيها النظام من البيانات: ضع المعرّف واترك القسم فارغًا، فنصُّ الآية ودرجةُ الحديث والسطرُ المرجعي تُنقل من المصدر لا من كتابتك.
- ولا يصحّ في ref إلا معرّف مقطعٍ من موسوعة القرآن أو موسوعة الحديث. فإن لم يكن النص في واحدة منهما — كحديثٍ لم يرد في موسوعة الحديث وإنما وجدته في صفحة مسترجعة — **فاترك ref فارغًا واكتب النص في القسم نفسه** بين «» للحديث و﴿﴾ للآية، موثّقًا بوسم citation. صفحةُ بحثٍ ليست مقطعًا من الموسوعات، ووضع معرّفها في ref يُفقد القسم محتواه.
- يجوز في ref أن تذكر أكثر من معرّف مفصولةً بفواصل، فتُعرض المقاطع كلها بترتيبها، ويُعرض تحتها رابطٌ لكل آية. استعمل ذلك للسورة القصيرة التي يُسأل عنها كاملةً.
- التوثيق بوسم citation داخل الأقسام النصية كما هو مطلوب في بقية الإجابة.
</answer_format>`;
};
