/**
 * The brief's term dictionary, enforced per question.
 *
 * Page 7 of the brief is not a glossary. It is ten terms, each with an approved
 * English equivalent *and* a ضابط استخدام — and most of those controls are
 * prohibitions on one specific plausible error: «الشريعة» collapsed into penal
 * law, «التوحيد» collapsed into numerical oneness, «العبادة» narrowed to rites.
 * Those are exactly the renderings a fluent model produces when left to its
 * own judgement, which is why the brief writes them down.
 *
 * The prompt already says to prefer the dictionary's equivalent over a
 * translation. What it could not say, without becoming unreadable, is what not
 * to do with each of these ten. So the control travels per question instead:
 * the term is detected, and its own ضابط is stated in the prompt for that turn
 * only. Ten rules in the prompt all the time would be noise; the one rule that
 * applies, stated when it applies, is a constraint.
 *
 * This is criterion 6 — الترجمة والتوطين — and the brief's own test cases 8 and
 * 12 score it directly.
 */

import { CLITIC, normalise } from "./normalise";

/** A term, the equivalent the brief approves, and the control it carries. */
export interface Term {
  /** The Arabic headword, for display in the injected rule. */
  term: string;
  /**
   * Written in normalised form, the way `intent.ts` requires its patterns to
   * be: «ة» has already become «ه» and «ى» has become «ي» by the time a
   * question is matched, so a variant spelled otherwise can never fire.
   */
  match: string[];
  /** The approved English equivalent, verbatim from the brief. */
  english: string;
  /**
   * How the term is written when the question is not in Arabic.
   *
   * The brief's case 12 is explicitly «سؤال بلغة غير عربية يتضمن مصطلحًا دينيًا
   * ذا دلالة ثقافية خاصة», and matching Arabic stems alone meant the control
   * never fired on exactly that case — the one the dictionary exists for. The
   * transliterations are the spellings a non-Arabic question actually uses,
   * which are not always the approved equivalent: somebody asking about
   * «shariah law» has written neither «الشريعة» nor «Sharia».
   */
  latin: string[];
  /** The ضابط, as a rule addressed to the model. */
  control: string;
}

/**
 * The ten, in the brief's own order.
 *
 * `english` is quoted rather than paraphrased. The whole point of an approved
 * equivalent is that it is not re-decided per answer, so a fluent-sounding
 * improvement here would defeat the criterion it exists to serve.
 */
const TERMS: Term[] = [
  {
    term: "الإسلام",
    latin: ["islam", "islamic"],
    match: ["اسلام"],
    english: "Islam",
    control:
      "دين الاستسلام لله بالتوحيد والانقياد له بالطاعة. يُشرح بحسب السياق، ولا يُختزل في معنى ثقافي عام ولا في هوية اجتماعية.",
  },
  {
    term: "التوحيد",
    latin: ["tawhid", "tawheed", "oneness of god", "monotheism"],
    match: ["توحيد"],
    english: "Tawhid / Oneness of God",
    control:
      "يُفضّل إبقاء المصطلح «Tawhid» مع شرح معناه: إفراد الله بالربوبية والألوهية ووصفه بما جاء الوحي به من أسمائه الحسنى. ولا يُختزل في ترجمة توحي بمجرّد الوحدانية العددية.",
  },
  {
    term: "العبادة",
    latin: ["ibadah", "ibada", "worship"],
    match: ["عباده"],
    english: "Worship",
    control:
      "تشمل أعمال القلب والقول والعمل التي يتقرّب بها العبد إلى الله. ولا تُحصر في الشعائر وحدها.",
  },
  {
    term: "النبوة",
    latin: ["prophethood", "nubuwwah"],
    match: ["نبوه"],
    english: "Prophethood",
    control:
      "تُستعمل للدلالة على اصطفاء الأنبياء بالوحي، مع التمييز بينها وبين القيادة الدينية البشرية.",
  },
  {
    term: "الوحي",
    latin: ["revelation", "wahy"],
    match: ["وحي"],
    english: "Revelation",
    control:
      "يُشرح بوصفه ما أوحاه الله إلى أنبيائه، مع تجنّب الاستعمالات الفضفاضة التي قد تُوهم الإلهام الشخصي.",
  },
  {
    term: "الشريعة",
    latin: ["sharia", "shariah", "shari'ah", "shariah law"],
    match: ["شريعه"],
    english: "Sharia / Islamic law and guidance",
    control:
      "تُشرح بحسب السياق، ولا تُختزل في العقوبات ولا في القانون الجنائي.",
  },
  {
    term: "الحديث",
    latin: ["hadith", "hadeeth"],
    match: ["حديث"],
    english: "Hadith",
    control:
      "ما نُقل عن النبي ﷺ من قول أو فعل أو تقرير ونحوه. ويُبيَّن درجة الثبوت عند الاستدلال به.",
  },
  {
    term: "السنة",
    latin: ["sunnah", "sunna"],
    match: ["سنه"],
    english: "Sunnah",
    control:
      "هدي النبي ﷺ وطريقته. ويُحدَّد المقصود بحسب السياق العلمي، إذ تختلف دلالتها بين الأصول والفقه والحديث.",
  },
  {
    term: "الفتوى",
    latin: ["fatwa", "fatwā"],
    match: ["فتوي"],
    english: "Fatwa",
    control:
      "جواب شرعي يصدره مؤهَّل في واقعة أو سؤال. ولا تُساوى بالمعلومة العامة، ولا يوصف ما يقدّمه هذا النظام بأنه فتوى.",
  },
  {
    term: "الدعوة",
    latin: ["dawah", "da'wah", "daawah"],
    match: ["دعوه"],
    english: "Da‘wah / Invitation to Islam",
    control:
      "التعريف بالإسلام والدعوة إليه بالحكمة. ويُختار المقابل بحسب السياق والجمهور.",
  },
];

/**
 * How many controls may be injected at once.
 *
 * A question can touch several of these — «ما الفرق بين السنة والحديث؟» hits
 * two — but a prompt carrying six of them has stopped constraining anything.
 * Three is the point at which the list is still read as rules rather than as
 * background.
 */
const MAX_TERMS = 3;

/**
 * Builds the matcher for one term.
 *
 * Shares the clitic-prefix logic with `intent.ts` deliberately rather than
 * importing it, because that module's `words()` is private to it and the two
 * lists have different needs: here a term is matched with a right boundary, so
 * «السنة» does not fire inside «السنين» and «عبادة» does not fire inside
 * «العبادات» — in a dictionary lookup the inflected plural is a different
 * headword, which is the opposite of what the topical patterns want.
 */
const matcher = (term: Term) =>
  new RegExp(
    `(?<![\\p{L}\\p{M}])${CLITIC}(?:${term.match.join("|")})(?![\\p{L}\\p{M}])`,
    "u",
  );

/**
 * The Latin matcher, with ordinary word boundaries.
 *
 * `\b` is useless for Arabic and exactly right here, and the whole point is
 * that a question in English never passes through the Arabic matcher at all.
 */
const latinMatcher = (term: Term) =>
  new RegExp(
    `\\b(?:${term.latin.map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
    "iu",
  );

const COMPILED = TERMS.map((term) => ({
  term,
  pattern: matcher(term),
  latin: latinMatcher(term),
}));

/** The sensitive terms this question touches, in the brief's order. */
export const termsIn = (question: string) => {
  const text = normalise(question);
  return COMPILED.filter(
    ({ pattern, latin }) => pattern.test(text) || latin.test(question),
  )
    .slice(0, MAX_TERMS)
    .map(({ term }) => term);
};

/**
 * The prompt block for a question's sensitive terms, or empty for none.
 *
 * Appended rather than woven into the base prompt, so that a turn touching none
 * of the ten carries none of this — and so that the rule the reader's question
 * actually triggered is the one the model sees.
 */
export const termGuards = (question: string) => {
  const terms = termsIn(question);
  if (terms.length === 0) return "";

  const lines = terms
    .map(
      (term) =>
        `- **${term.term}** — المقابل المعتمد: «${term.english}». ${term.control}`,
    )
    .join("\n");

  return `\n\n<approved_terminology>
السؤال يتضمن مصطلحًا شرعيًا حسّاسًا. استعمل المقابل المعتمد أدناه لا ترجمةً حرفية، والتزم ضابطه:

${lines}

إن لم يكفِ المقابل وحده فاشرح المصطلح، ولا تُغيِّر المضمون لتوافق توقّعات القارئ. وإن احتجت تفصيلًا أوسع فاقرأه من قاموس المصطلحات المعتمد بأدواتك، لا من معرفتك.
</approved_terminology>`;
};
