/**
 * Who is reading, which decides *which sources are read* and how they are
 * quoted.
 *
 * The MVP specification's third axis, and the one this system was missing. It
 * is not the depth preference under another name — that is a length control,
 * written as one — and the difference is what the specification does with it:
 *
 *   «التفسير حسب مستوى المستخدم — **تختلف المصادر بحسب مستوى السائل**.»
 *
 * Different *sources*. A non-specialist is served التفسير الميسر and المختصر;
 * a specialist is served الطبري، ابن كثير، البغوي، السعدي «مع ذكر الطبعة». So
 * this is a retrieval decision before it is a presentation one, which is why
 * the editions live here rather than in a component.
 *
 * Until now the specialist set was being served to everyone — `DEFAULT_SOURCES`
 * in `mcp/tafsir.ts` was الطبري، ابن كثير، السعدي — which is a wrong default
 * rather than a missing feature: it hands a reader who asked a simple question
 * four classical commentaries and none of the two written to be read plainly.
 */

export type Expertise = "general" | "specialist";

export const EXPERTISE_LEVELS: { value: Expertise; label: string }[] = [
  { value: "general", label: "عامّ" },
  { value: "specialist", label: "متخصّص" },
];

/**
 * The general reader, because that is who arrives without saying.
 *
 * The specification's own ordering — it describes غير المتخصص first and names
 * the simplified editions for it — and the safer default of the two: a
 * specialist served plain commentary is under-served, while a general reader
 * served الطبري is not served at all.
 */
export const DEFAULT_EXPERTISE: Expertise = "general";

/**
 * The commentary editions each level reads, from §3.3 of the specification.
 *
 * Slugs as مركز تفسير spells them. `fetch_tafsir` rejects the entire call on a
 * single unknown slug — `'mukhtasar' is not a valid TafsirSource`, which cost a
 * silently empty panel once already — so check `list_tafsir_sources` before
 * editing these.
 */
export const TAFSIR_EDITIONS: Record<Expertise, string[]> = {
  /* مبسّط: التفسير الميسر · المختصر في تفسير القرآن الكريم */
  general: ["moyassar", "mukhtasar_ar"],
  /* مع ذكر الطبعة: السعدي · البغوي · ابن كثير · الطبري */
  specialist: ["saadi", "baghawy", "katheer", "tabary"],
};

/**
 * The register each level is written in.
 *
 * Stated once and applied to every prose section, rather than threaded into
 * each section's own brief. The register is a property of the reader, not of
 * the section: the same instruction governs المعنى المبسّط in a hadith card and
 * تفسير الآية in a commentary, and splitting it across a dozen briefs would
 * only make them disagree.
 *
 * The non-specialist wording is the specification's own — «المعنى المبسّط
 * بالفصحى البيضاء» — and it is a constraint on *language*, never on accuracy.
 * Simplifying a ruling is not the same as softening it, and the one thing a
 * "write plainly" instruction tends to erode is exactly the grading and the
 * attribution, so both are restated.
 */
const INSTRUCTIONS: Record<Expertise, string> = {
  general: `<reader_level>
القارئ غير متخصص. اكتب بالفصحى البيضاء: جملٌ قصيرة، ولفظٌ مستعمل، وبناءٌ يبدأ من المعلوم إلى المجهول.

- إن اضطررت إلى مصطلح شرعي في أثناء الجواب فاذكره ثم اشرحه في موضعه، ولا تُحِل القارئ إلى معجم.
- وإن كان المصطلح نفسه هو موضوع السؤال وكان السائل لا يعرفه — كمن يسأل عن معناه «ولم يسمع به من قبل» — **فابدأ بالمعنى بعبارة غير اصطلاحية، ثم سمِّ المصطلح بعد أن يستقرّ المعنى**. تسميةُ ما لم يُفهم بعدُ لا تُفيد السائل شيئًا.
- لا تُثقل الجواب بأسماء الكتب والطبعات في متنه؛ النسبة تكفي، والتفصيل في المصادر.
- اعرض القول المعتمد ولا تستعرض الأقوال الشاذة ولا الخلاف الذي لا يبني عليه القارئ عملًا.

التبسيط في العبارة لا في المضمون. كل حديث يبقى بدرجته واسم من حكم عليه، وكل نقل يبقى منسوبًا إلى صاحبه، وما لم تجده في المصادر لا يُستكمل من معرفتك.
</reader_level>`,
  specialist: `<reader_level>
القارئ متخصص. استعمل الاصطلاح العلمي على وجهه، ولا تُبسِّط ما لا يحتاج تبسيطًا.

- انسب كل نقل إلى كتابه **وطبعته كما وردت في المصدر**، لا إلى صاحبه وحده.
- اذكر مواضع الخلاف وأسبابه، ومن قال بكل قول، ومن رجّح، بنسبة الترجيح إلى من رجّحه.
- اذكر في الحديث درجته ومن حكم عليه، وتعدّد الأحكام إن تعدّدت، واختلاف الألفاظ إن كان مؤثرًا في المعنى.

التخصص ليس إذنًا بالتوسع خارج المقاطع المسترجعة؛ ما لم يرد في المصادر يُقال إنه لم يرد.
</reader_level>`,
};

/** Appends the reader-level instruction to a composed system prompt. */
export const withExpertise = (
  prompt: string,
  level: Expertise | undefined,
) => `${prompt}\n\n${INSTRUCTIONS[level ?? DEFAULT_EXPERTISE]}`;

/**
 * Every edition this reader may see — what the علوم الآية pane lists.
 *
 * Exported as a function rather than read from the table directly, so a missing
 * preference lands on the general reader rather than on whatever the table's
 * first key happens to be.
 */
export const tafsirEditionsFor = (level: Expertise | undefined) =>
  TAFSIR_EDITIONS[level ?? DEFAULT_EXPERTISE];

/**
 * The editions the **answer** is written from, which is not the same list.
 *
 * A non-specialist was getting both التفسير الميسر and المختصر woven into every
 * commentary answer, so each point arrived twice — «(التفسير الميسر)» and
 * «(المختصر في التفسير)» on the same sentence, saying the same thing in two
 * wordings. «المعنى الإجمالي» is one meaning; it is written from التفسير
 * الميسر, the plainer of the two and the one the specification names first for
 * a reader who is not a specialist.
 *
 * المختصر is not dropped — it is in `TAFSIR_EDITIONS` still, so the علوم الآية
 * pane lists it beside the rest. The answer gives the meaning once; the
 * comparison is a tap away.
 *
 * The specialist list is unchanged. Four classical commentaries presented side
 * by side is the point of that level — «اذكر مواضع الخلاف وأسبابه، ومن قال بكل
 * قول» — and narrowing it to one would remove the axis rather than tidy it.
 */
const ANSWER_EDITIONS: Record<Expertise, string[]> = {
  general: ["moyassar"],
  specialist: TAFSIR_EDITIONS.specialist,
};

export const answerEditionsFor = (level: Expertise | undefined) =>
  ANSWER_EDITIONS[level ?? DEFAULT_EXPERTISE];

/**
 * Every edition the علوم الآية pane lists, whoever is reading.
 *
 * The level scopes **what the answer rests on**, which is what the
 * specification's «تختلف المصادر بحسب مستوى السائل» is about. The pane is not
 * the answer: it is a reference a reader opens on purpose, and scoping it too
 * left a non-specialist who tapped التفاسير looking at two entries with no way
 * to reach الطبري أو ابن كثير at all — for a surface named علوم الآية that is
 * the wrong answer to a deliberate question.
 *
 * Ordered simple first, so the list reads from the plainest to the most
 * demanding rather than by a level the reader did not pick.
 */
export const ALL_TAFSIR_EDITIONS: string[] = [
  ...TAFSIR_EDITIONS.general,
  ...TAFSIR_EDITIONS.specialist,
];
