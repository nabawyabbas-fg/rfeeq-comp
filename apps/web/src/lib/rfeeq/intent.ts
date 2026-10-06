/**
 * Which kind of question this is, and what the system may say back.
 *
 * Two independent axes, because the brief has two and the existing prompt
 * system has only one:
 *
 *   intent — *which corpus may answer*, from the domain table in
 *            `docs/competition/approved-sources.md`
 *   level  — *what may be asserted* once the material is in hand, from the
 *            أ/ب/ج/د table in `docs/competition/scope-and-levels.md`
 *
 * They do not collapse. «ما حكم صلاة المسافر؟» and «أنا مسافر غدًا، هل أقصر
 * الصلاة؟» share the intent `fiqh` and retrieve the same passages; the first is
 * level (ب) and the second is level (د), where the system must not rule at all.
 * Keying the prompt off the namespace — which is what
 * `agentic-search/corpus-prompts.ts` does — expresses the first axis and has no
 * way to express the second.
 *
 * A third, dependent value falls out of the two: the **template**, meaning
 * which of the approved answer presentations to render. Intent chooses the
 * corpus; template chooses the layout. They are close but not the same — a
 * `hadith` question is presented as an authenticity card or as an explanation
 * depending on what was asked of it.
 *
 * Deliberately a pattern classifier rather than a model call. It runs on submit
 * to choose a heading and a disclaimer, it must agree with itself across a
 * reload, and a wrong answer is visible to the reader — all three argue for
 * rules that can be read, tested and corrected over a judgement that cannot.
 * The patterns match Arabic question *forms* rather than topics: a topic list
 * needs endless extension, while «ما حكم …» is a finite grammar.
 */

import { normalise } from "./normalise";

/** The corpus axis — the brief's المجال, one per row of the allow-list. */
export type RfeeqIntent =
  | "quran"
  | "tafsir"
  | "hadith"
  | "aqida"
  | "fiqh"
  | "sira-history"
  | "shubuhat"
  | "language"
  | "terminology"
  | "dawa"
  /**
   * Not a corpus — a routing outcome. A level-(د) question does not get
   * different sources, it gets a different answer contract: explain what the
   * books say in general, and refer the particular case onward.
   */
  | "fatwa-referral";

/** The brief's four response levels, أ through د. */
export type RfeeqLevel = "a" | "b" | "c" | "d";

/** The approved answer presentations. */
export type RfeeqTemplate =
  | "arabic" // a word's meaning, in the lexicon's terms
  | "aya" // the verse itself
  | "tafsir" // the Qurʾān explained
  | "hadith-card" // a hadith's authenticity
  | "hadith-explain" // a hadith's meaning
  | "fatwa" // a ruling, as a source states it
  | "general";

/**
 * What the brief puts outside the system's scope.
 *
 * Page 2 excludes four things, not one — «ولا يدخل في النطاق إصدار الفتوى
 * الشخصية المستقلة، أو الحكم على الأشخاص والجماعات، أو معالجة النزاعات الخاصة،
 * أو بناء أحكام شرعية على وقائع فردية غير متحققة». Each is a limit on the
 * *speech act* rather than a topic ban: the general material is still owed to
 * the reader, and only the particular judgement is withheld.
 *
 * All four route to level (د), because the answer contract is the same shape in
 * every case — say what will not be done, give the general information, refer —
 * but they need distinct wording, so the reason travels with the routing.
 */
export type RfeeqExclusion =
  | "personal-case" // إصدار الفتوى الشخصية المستقلة
  | "persons-groups" // الحكم على الأشخاص والجماعات
  | "private-dispute" // معالجة النزاعات الخاصة
  | "hypothetical"; // بناء أحكام شرعية على وقائع فردية غير متحققة

export interface RfeeqRouting {
  intent: RfeeqIntent;
  level: RfeeqLevel;
  template: RfeeqTemplate;
  /** The question asks the system to adjudicate a disagreement. */
  asksDisagreement: boolean;
  /** Which scope exclusion applies, if any. Drives the answer contract. */
  exclusion: RfeeqExclusion | null;
  /** The question is about the asker's own case; kept as the common shorthand. */
  isPersonalCase: boolean;
}

/*
 * Pattern compilation.
 *
 * `\b` is unusable here: JavaScript defines it over `[A-Za-z0-9_]`, so between
 * a space and an Arabic letter there is no boundary at all and `/\bحديث\b/`
 * matches nothing. Every pattern below is compiled instead with a
 * Unicode-aware left boundary that tolerates the clitic prefixes Arabic
 * attaches to a noun — ال, و, ب, ف, ل and their combinations — so one term
 * covers «حديث» and «الحديث» and «وحديث».
 *
 * There is deliberately no right boundary. Arabic suffixes (ـا, ـها, ـهم, the
 * tāʾ marbūṭa) would otherwise each need listing, and the cost of allowing
 * them is false positives on terms that *contain* a shorter term. The term
 * lists answer that by being specific — «ما حكم» rather than bare «حكم», which
 * would also fire inside «الحكمة».
 */
const PREFIX = "(?:ال|وال|بال|كال|فال|لل|و|ف|ب|ك|ل)?";

/**
 * `whole` adds a right boundary as well, for terms where a following letter
 * changes the meaning entirely.
 *
 * Needed, and not optional, for the possessive markers: without it «صلاتي» (my
 * prayer) matches inside «الصلاتين» (the two prayers), «مالي» inside
 * «المالية», and «عملي» inside «العملية» — so «ما حكم الجمع بين الصلاتين في
 * السفر؟» was being read as somebody's own case and referred away unanswered.
 * The topical lists keep the looser form on purpose, since Arabic suffixes
 * there are inflection rather than a change of sense.
 */
/**
 * Every pattern is compiled against *normalised* text, so it must be written in
 * normalised form too.
 *
 * This is not a style rule, it is a correctness one, and it has already cost
 * real routing. `normalise` folds «ى» to «ي» and «ة» to «ه», so a term written
 * «معنى» can never match anything: the input has become «معني» by the time the
 * pattern sees it. Six terms were written that way and every one of them was
 * dead — «ما معنى …» questions were falling through the tafsīr and terminology
 * rules into whatever matched next.
 *
 * Folding the pattern through the same function closes the class of bug rather
 * than the instances of it: a term is now written the way Arabic spells it and
 * normalised to match the text it is tested against. Safe on a regex source as
 * well, since `normalise` touches only Arabic letters and runs of whitespace —
 * never `(?:`, `|`, `[^؟]` or a backslash escape.
 */
const folded = (source: string) => normalise(source);

const words = (terms: string[], { whole = false } = {}) =>
  new RegExp(
    `(?<![\\p{L}\\p{M}])${PREFIX}(?:${terms.map(folded).join("|")})` +
      (whole ? "(?![\\p{L}\\p{M}])" : ""),
    "u",
  );

/** Matches only where the phrase opens the question. */
const opener = (terms: string[]) =>
  new RegExp(`^(?:${terms.map(folded).join("|")})`, "u");

/** A hand-written pattern source, folded the same way a term list is. */
const pattern = (source: string) => new RegExp(folded(source), "u");

/* ---------- intent ---------- */

/**
 * Intent, first match wins, so the order is part of the rule.
 *
 * How a question is *framed* decides its domain before what it *mentions*
 * does: a translation request, then a historical claim, then a doubt, and only
 * then the content domains. Each step below says why it sits where it does.
 */
const INTENT_PATTERNS: [RegExp, RfeeqIntent][] = [
  /*
   * A translation request stays a translation request whatever its subject:
   * «ترجم كلمة التوحيد» is not an ʿaqīda question that happens to mention
   * English, and the approved-equivalent rule has to beat a fluent rendering.
   */
  [
    words([
      "ترجم",
      "ترجمه",
      "بالانجليزيه",
      "بالانجليزي",
      "بالاجنبيه",
      "المقابل المعتمد",
      "المقابل الانجليزي",
      // deliberately not bare «مصطلح»: case 7 of the brief asks the meaning of
      // tawḥīd «لشخص لم يسمع بالمصطلح من قبل» and is an ʿaqīda question that
      // names the word in passing. A translation needs a translation signal.
      "ترجمه مصطلح",
      "معنى مصطلح",
    ]),
    "terminology",
  ],
  /*
   * History before doubt, on the brief's own reasoning.
   *
   * «هل الإسلام انتشر بالسيف؟» arrives in accusation form, and the brief still
   * files it under السيرة والتاريخ — its expected handling is
   * «تمييز السؤال التاريخي عن الاتهام العام». Answering it as a doubt would
   * address the accusation; answering it as history addresses the question,
   * which is what was asked. So a historical claim wins over the challenge
   * framing wrapped around it.
   */
  [
    words([
      "السيره",
      "سيره النبي",
      "التاريخ",
      "تاريخ",
      "الفتوحات",
      "الغزوات",
      "غزوه",
      "الخلافه",
      "انتشر",
    ]),
    "sira-history",
  ],
  /*
   * A doubt or an objection: the subject is Islam itself, in challenge form,
   * with no historical claim to examine underneath. Still ahead of the content
   * domains — «هل القرآن من تأليف محمد ﷺ؟» names the Qurʾān but is a doubt to
   * answer dialogically, not a verse to look up.
   */
  [
    pattern(
      "(?:لماذا|لم|كيف)\\s+(?:يعبد|يمنع|يحرم|يبيح|يفرض|يامر|يسمح|يجيز|تضطهد|يظلم)" +
        "|هل\\s+(?:الاسلام|القران|المسلمون|المسلمين|محمد|النبي)[^؟]*" +
        "(?:تاليف|انتشر|السيف|يظلم|ضد|يكره|عنف|ارهاب|يضطهد|متناقض)" +
        "|شبهه|الشبهات|يتهم|الاتهام",
    ),
    "shubuhat",
  ],
  [words(["سبب نزول", "اسباب النزول"]), "tafsir"],
  // Commentary is a relation between two things, so both orders are matched:
  // the act of explaining and the thing explained, either first.
  /*
   * The explained thing is matched with its article optional — «تفسير الآية»
   * and «تفسير آية الكرسي» are the same question, and requiring «الآية» sent
   * the second one to the bare-Qurʾān rule below, which offers no commentary
   * tool at all.
   */
  [
    pattern(
      "(?:تفسير|فسر|معنى|معاني|فوائد|مقاصد|مقصد|شرح|اشرح|المراد|غريب)" +
        "[^؟]*(?:ال)?(?:ايه|ايات|سوره|قوله تعالى|القران)" +
        "|(?:ال)?(?:ايه|ايات|سوره|قوله تعالى)[^؟]*" +
        "(?:تفسير|معنى|فوائد|شرح|المراد|غريب)",
    ),
    "tafsir",
  ],
  /* «غريب القرآن» names the science; a bare «معنى كلمة» is now the lexical
     rule's, since the relational rule above already claims a word tied to an
     āya. */
  [words(["غريب القران"]), "tafsir"],
  [
    words([
      "حديث",
      "حديثا",
      "الاحاديث",
      "احاديث",
      "الاثر",
      "سنن",
      "السنه النبويه",
      "قول النبي",
      "قوله صلي",
      "رواه",
      "راوي",
      "الراوي",
      "متن",
      "الاسناد",
    ]),
    "hadith",
  ],
  [
    words([
      "الايه",
      "ايه",
      "الايات",
      "سوره",
      "القران",
      "قوله تعالي",
      "المصحف",
      "التجويد",
      "القراءات",
    ]),
    "quran",
  ],
  [
    words([
      "التوحيد",
      "العقيده",
      "الايمان",
      "اركان الاسلام",
      "اركان الايمان",
      "الاسماء والصفات",
      "القدر",
      "الشرك",
      "الكفر",
      "البدعه",
      "عقيده",
    ]),
    "aqida",
  ],
  [
    words([
      "ما حكم",
      "حكم شرعي",
      "الحكم الشرعي",
      "احكام",
      "هل يجوز",
      "هل تجوز",
      "يحرم",
      "مشروعيه",
      "كفاره",
      "المذاهب",
      "مذهب",
      "الراجح",
      "فقه",
      "الفقه",
      "الصلاه",
      "صلاه",
      "الزكاه",
      "الصيام",
      "صيام",
      "الحج",
      "الطهاره",
      "النكاح",
      "الطلاق",
      "المعاملات",
      "اقصر",
      "افطر",
    ]),
    "fiqh",
  ],
  /*
   * The five taklīfī categories as bare adjectives.
   *
   * «هل كل المسلمين يتفقون على أن الموسيقى حرام؟» — the brief's case 10 — is a
   * ruling question and was reaching the daʿwa default, which cost it the fiqh
   * sources *and* the fatwā template's اختلاف العلماء section, the one place
   * the disagreement it asks about would have been laid out properly.
   *
   * «حرام» needs the lookbehind: it sits inside «المسجد الحرام», «البيت
   * الحرام», «الشهر الحرام» and «البلد الحرام», none of which is a ruling
   * question. The other four carry no such fixed phrase.
   */
  [
    pattern(
      "(?<![\\p{L}\\p{M}])(?:ال|و|ف|ب|ل)?(?:حلال|مكروه|مباح|مندوب|مستحب)(?![\\p{L}\\p{M}])" +
        "|(?<!المسجد )(?<!البيت )(?<!الشهر )(?<!البلد )(?<![\\p{L}\\p{M}])(?:ال|و|ف|ب|ل)?حرام(?![\\p{L}\\p{M}])",
    ),
    "fiqh",
  ],
  /*
   * A word's own meaning — the specification's §6, «قالب لبيان معنى أي لفظ»,
   * whose own example is «ما معنى التقوى؟».
   *
   * **Last but one, and that placement is the rule.** A meaning question about
   * a word that already belongs to a domain belongs to that domain: «ما معنى
   * التوحيد لشخص لم يسمع بالمصطلح من قبل؟» is the brief's own case 7 and is
   * ʿaqīda, «ما معنى كلمة «أبّا» في القرآن؟» is غريب القرآن, «ما معنى مصطلح
   * الإحصان؟» is المصطلحات. Each of those rules sits above this one and takes
   * its question first.
   *
   * What reaches here is a word with no subject of its own — which is exactly
   * what the lexical template is for, and why no amount of negative lookahead
   * was the right tool: the exclusions are the other rules.
   */
  [
    pattern(
      "(?:ما |ماذا )?(?:معنى|المعنى|تعريف|دلالة|اشتقاق|جذر|مادة)" +
        "|المعنى اللغوي|في اللغة والاصطلاح|لغةً واصطلاحًا|ما الفرق بين",
    ),
    "language",
  ],
  [
    words([
      "الدعوه",
      "داعيه",
      "التعريف بالاسلام",
      "غير المسلمين",
      "مقارنه الاديان",
    ]),
    "dawa",
  ],
];

/* ---------- level ---------- */

/**
 * A stake in the question that makes it somebody's particular case.
 *
 * First person, a possessed act of worship, a named relative, or a reported
 * incident. Any of these turns a category question into a situation.
 */
/**
 * A stake that can only be somebody's particular case.
 *
 * A possessed act of worship or contract, a reported slip, or a relative whose
 * situation is the subject. None of these can be read as a question about a
 * category: «نسيت التشهد في صلاتي» is not a question about forgetting the
 * tashahhud in general. Sufficient on its own for level (د).
 */
const OWN_CASE = words(
  [
    "حالتي",
    "حالي",
    "وضعي",
    "عقدي",
    "شركتي",
    "مالي",
    "عملي",
    "مرضي",
    "طلاقي",
    "زواجي",
    "صلاتي",
    "صيامي",
    "زكاتي",
    "نكاحي",
    "طهارتي",
    "زوجتي",
    "زوجي",
    "ولدي",
    "ابني",
    "فعلت",
    "نسيت",
    "اخطات",
    "حصل لي",
    "جري لي",
  ],
  { whole: true },
);

/**
 * A weaker first-person marker.
 *
 * «أنا» and «عندي» appear in questions that are not asking for a ruling at all
 * — «أنا مسلم جديد، ما أركان الإسلام؟» is level (أ). So these need a decision
 * request or a ruling-shaped domain alongside them.
 */
const SPEAKER = words(["انا", "عندي", "لدي", "ابي", "امي"], {
  whole: true,
});

/**
 * A verdict on a person: takfīr and its neighbours.
 *
 * Never sufficient on its own — «ما حكم التكفير؟» and «ما معنى النفاق؟» are
 * legitimate doctrinal questions about the *concept*, and the brief approves
 * answering them. What it excludes is the verdict landing on someone, so this
 * list is only ever read together with `NAMED_SUBJECT` below.
 */
const VERDICT_ON_PERSON = words([
  "كافر",
  "كفار",
  "كافره",
  "مرتد",
  "منافق",
  "مبتدع",
  "ضال",
  "فاسق",
  "زنديق",
  "مشرك",
  "يكفر",
  "تكفير",
  "في النار",
  "من اهل النار",
  "مخلد في النار",
  "هل يخرج من الملة",
  "خارج عن الاسلام",
]);

/**
 * A particular person or a particular group, as a question names one.
 *
 * Deliberately shaped around the *forms* a question uses to point at someone —
 * «فلان», «هذا الرجل», «هؤلاء», «جماعة كذا» — rather than around any list of
 * names, which could never be complete and would be the wrong kind of list for
 * this codebase to carry.
 */
const NAMED_SUBJECT = pattern(
  "(?<![\\p{L}\\p{M}])(?:ال|و|ف|ب|ل)?(?:" +
    // the pronouns and placeholders a question points with
    "فلان|هذا الرجل|هذا الشخص|هذه المرأة|هؤلاء|أولئك" +
    // a group, named or not
    "|جماعة|فرقة|طائفة|حزب|تنظيم|أتباع|مذهب" +
    /*
     * Kinship and acquaintance, with the possessive suffix open: «جاري» and
     * «جارنا» and «جاره» are one subject asked about three ways, and the first
     * draft listed only the first — so «هل جارنا هذا كافر؟» went unguarded.
     */
    "|(?:جار|زميل|صاحب|شريك|أب|أم|أخ|أخت|عم|خال|ابن|بنت|زوج|زوجة|قريب)(?:ي|نا|ه|ها|هم)" +
    ")(?![\\p{L}\\p{M}])" +
    /*
     * Bare third-person pronouns, which are only ever read alongside a verdict
     * word — «هل هو كافر؟» is the commonest form of the question this guard
     * exists for, and «هو» on its own is far too common to key on.
     */
    "|(?<![\\p{L}\\p{M}])(?:هو|هي|هم|هن)(?![\\p{L}\\p{M}])",
);

/**
 * A dispute between parties, which this system must not adjudicate.
 *
 * The honest reason is epistemic rather than legal: an answer hears one side
 * and verifies no fact, so a ruling between parties would be a guess wearing a
 * ruling's clothes.
 */
const PRIVATE_DISPUTE = words([
  "نزاع",
  "خصومه",
  "تنازع",
  "مشكله بيني",
  "خلاف بيني",
  "بيني وبين",
  "بيني وبينه",
  "بيني وبينها",
  "رفعت عليه",
  "رفع علي قضيه",
  "دعوي قضائيه",
  "شكوي علي",
  "نتخاصم",
  "اختلفنا",
  "يرفض ان يعطيني",
  "ياخذ حقي",
  "حقي عند",
]);

/**
 * A supposed case rather than a real one.
 *
 * Bare «لو» is unusable — «لو سمحت» is a pleasantry — so every term here
 * carries its complement. A ruling built on a supposition is a ruling on
 * nothing, and the brief names that exclusion in those terms: وقائع فردية غير
 * متحققة.
 */
const HYPOTHETICAL = words([
  "لو ان",
  "لو اني",
  "لو انه",
  "لو فرضنا",
  "لو قدرنا",
  "افترض ان",
  "بافتراض",
  "هب ان",
  "ماذا لو",
  "علي سبيل الفرض",
  "فرضا ان",
  "لو حدث ان",
]);

/** A request for a decision rather than for information. */
const DECISION_REQUEST = words([
  "هل يجوز لي",
  "يجوز لي",
  "هل علي",
  "هل يلزمني",
  "يجب علي",
  "ماذا افعل",
  "ما يلزمني",
  "هل تصح",
  "هل يصح",
  "اقصر",
  "افطر",
  "اعيد",
  "اقضي",
  "يجزي",
  "يبطل",
  "هل يجوز",
  "هل تجوز",
  "ما حكم",
]);

/**
 * Disagreement, detailed creed, contested history — the brief's level (ج).
 *
 * Includes consensus claims: «هل كل المسلمين يتفقون» asks the system to assert
 * an agreement, and asserting an agreement that is not established is the same
 * error as asserting a disagreement that is not. Criterion 2's
 * التمييز بين القطعي والاجتهادي cuts both ways.
 */
const CONTESTED = words([
  "اقوال المذاهب",
  "اختلاف العلماء",
  "الخلاف",
  "خلاف العلماء",
  "المذاهب الاربعه",
  "الراجح",
  "يتفقون",
  "متفقون",
  "اتفاق",
  "مجمع عليه",
  "الاجماع",
  "كل المسلمين",
  "تكفير",
  "الامامه",
  "اهل البدع",
  "الفرق الاسلاميه",
  "بالسيف",
]);

/**
 * An explanatory opener.
 *
 * Distinguishes two questions the brief grades differently. «لماذا توجد أحكام
 * مختلفة بين العلماء؟» asks why ijtihād produces difference and is level (ب),
 * answerable from the approved material; «هل كل المسلمين يتفقون في هذه
 * المسألة؟» asks the system to settle the status of a particular مسألة, which
 * is (ج). The difference is in the opener, not in the topic.
 *
 * Anchored to the start of the question, because the same words mid-sentence
 * are not framing it — «ما الراجح، وكيف نشأ الخلاف؟» is still a request to
 * adjudicate.
 */
const EXPLANATORY = opener([
  "لماذا",
  "لم ",
  "ما سبب",
  "ما سر",
  "كيف",
  "اشرح",
  "وضح",
  "ما معنى",
  "ما المقصود",
  "عرف",
]);

/**
 * Settled material: the text itself, a bare count, an approved equivalent.
 *
 * Terminology is deliberately *not* level (أ) as a class, which it was until
 * reading the brief's own cases against each other. Case 8,
 * «ترجم كلمة التوحيد إلى الإنجليزية», is a dictionary lookup and is (أ); case
 * 12, a term with particular cultural weight that has to be explained in
 * context, is (ب). The translation imperatives below are what separate them —
 * asking to *translate* is settled, asking what a term *means* is not.
 */
const STABLE = words([
  "اعرض",
  "نص الايه",
  "كم عدد",
  "متي نزلت",
  "في اي سوره",
  "من راوي",
  "ما اركان",
  "اعطني حديثا",
  "ترجم",
  "المقابل المعتمد",
]);

/**
 * The patterns are Arabic. A question in another language matches none of them
 * and falls through to `dawa`, the brief's broadest domain.
 *
 * A real limitation, not a rounding error: the brief's case 12 is explicitly
 * «سؤال بلغة غير عربية», and this classifier cannot route it. Non-Arabic
 * questions need either a translated probe or a model call, and that is a
 * decision about latency and cost rather than about patterns — see open
 * question 1 in `docs/competition/intent-map.draft.md`.
 */
const matchIntent = (text: string): RfeeqIntent => {
  for (const [pattern, intent] of INTENT_PATTERNS) {
    if (pattern.test(text)) return intent;
  }
  return "dawa";
};

/* ---------- template ---------- */

/**
 * Which presentation to render, given the corpus and the question's form.
 *
 * `fatwa-referral` deliberately keeps the `fatwa` layout rather than getting
 * one of its own: the reader asked a ruling question and should see the ruling
 * material laid out as such, with the referral stated inside it. Replacing the
 * answer with a bare referral would withhold the general information the brief
 * says to provide.
 */
const templateFor = (intent: RfeeqIntent, text: string): RfeeqTemplate => {
  switch (intent) {
    case "quran":
      return words(["اعرض", "نص الايه", "اقرا", "اكتب الايه", "المصحف"]).test(
        text,
      )
        ? "aya"
        : "tafsir";
    case "language":
      return "arabic";
    case "tafsir":
      return "tafsir";
    case "hadith":
      // the authenticity question and the meaning question are different
      // presentations of the same corpus
      return words([
        "ما صحه",
        "صحه",
        "هل يصح",
        "هل صح",
        "درجه",
        "تخريج",
        "ثبوت",
        "صحيح",
        "ضعيف",
        "موضوع",
        "يثبت",
      ]).test(text)
        ? "hadith-card"
        : words([
              "اشرح",
              "شرح",
              "معنى",
              "فوائد",
              "المراد",
              "راوي",
              "رواه",
            ]).test(text)
          ? "hadith-explain"
          : "hadith-card";
    case "fiqh":
    case "fatwa-referral":
      return "fatwa";
    default:
      return "general";
  }
};

/**
 * Classifies a question on both axes.
 *
 * Level precedence is explicit, and (د) wins outright. The draft intent map
 * calls level-(د) detection the highest-stakes classifier in the system: a
 * false negative means issuing a fatwa, which the brief puts out of scope
 * entirely, while a false positive costs a reader an unnecessary referral. So
 * it fails toward (د) — a personal stake alone is enough inside the
 * ruling-shaped domains, without also needing an explicit request to decide.
 */
export const routeQuestion = (question: string): RfeeqRouting => {
  const text = normalise(question);
  const corpusIntent = matchIntent(text);

  const decides = DECISION_REQUEST.test(text);
  const rulingDomain = corpusIntent === "fiqh";

  /*
   * Fails toward (د), as the draft intent map prescribes: a false negative
   * means issuing a fatwa, which the brief puts out of scope entirely, while a
   * false positive costs one unnecessary referral.
   *
   * Two tiers rather than one test. An unmistakable own-case marker is enough
   * by itself; a bare «أنا» needs something asking for a decision, or a domain
   * where answering means ruling.
   */
  const isPersonalCase =
    OWN_CASE.test(text) || (SPEAKER.test(text) && (decides || rulingDomain));

  /*
   * Which exclusion applies, most serious first.
   *
   * The order is the ranking of harm, not of likelihood. A verdict on a named
   * person or group is the gravest thing asked of this system and the one the
   * brief is most explicit about, so it wins over a personal-case reading even
   * when both fire — «هل أبي كافر؟» is both, and must be answered as the
   * former. A supposition comes last: when a question is both supposed and
   * personal, the personal contract is the more useful of the two.
   */
  const exclusion: RfeeqExclusion | null =
    VERDICT_ON_PERSON.test(text) && NAMED_SUBJECT.test(text)
      ? "persons-groups"
      : PRIVATE_DISPUTE.test(text)
        ? "private-dispute"
        : isPersonalCase
          ? "personal-case"
          : HYPOTHETICAL.test(text) && (decides || rulingDomain)
            ? "hypothetical"
            : null;

  const asksDisagreement = CONTESTED.test(text) && !EXPLANATORY.test(text);

  const level: RfeeqLevel = exclusion
    ? "d"
    : asksDisagreement
      ? "c"
      : STABLE.test(text)
        ? "a"
        : "b";

  /*
   * The referral outcome replaces the corpus intent, since it is what decides
   * the answer contract downstream. A verdict-on-persons question keeps its own
   * corpus — it is answered from the creed material, not from the fatwa bodies
   * — because what it needs is the doctrinal ضوابط, which is where those live.
   */
  const intent: RfeeqIntent =
    exclusion === "personal-case" ||
    exclusion === "private-dispute" ||
    exclusion === "hypothetical"
      ? "fatwa-referral"
      : corpusIntent;

  return {
    intent,
    level,
    template: templateFor(intent, text),
    asksDisagreement,
    exclusion,
    isPersonalCase,
  };
};

/* ---------- labels ---------- */

export const LEVEL_LABEL: Record<RfeeqLevel, string> = {
  a: "أ",
  b: "ب",
  c: "ج",
  d: "د",
};

/** The المجال a reader is told the answer came from. */
export const INTENT_DOMAIN: Record<RfeeqIntent, string> = {
  quran: "القرآن",
  tafsir: "التفسير",
  hadith: "الحديث",
  aqida: "العقيدة",
  fiqh: "الفقه",
  "sira-history": "السيرة والتاريخ",
  shubuhat: "الشبهات",
  language: "اللغة العربية",
  terminology: "المصطلحات",
  dawa: "التعريف بالإسلام",
  "fatwa-referral": "الفقه",
};

export const INTENT_ICON: Record<
  RfeeqIntent,
  "quran" | "hadith" | "library" | "globe"
> = {
  quran: "quran",
  tafsir: "quran",
  hadith: "hadith",
  aqida: "library",
  fiqh: "library",
  "sira-history": "library",
  shubuhat: "globe",
  language: "globe",
  terminology: "globe",
  dawa: "globe",
  "fatwa-referral": "library",
};
