import type { RfeeqIntent, RfeeqLevel } from "@/lib/rfeeq/intent";
import { routeQuestion } from "@/lib/rfeeq/intent";
import { describe, expect, it } from "vitest";

/**
 * The twelve published test cases from the challenge brief
 * (`docs/competition/eval-questions.json`), as a regression floor for the
 * classifier.
 *
 * Ten of the twelve are quoted and are asserted verbatim. Cases 11 and 12 are
 * only *described*, so they carry no question text and are documented rather
 * than asserted — inventing a question and then asserting a level against it
 * would be testing this file's guesses, not the brief.
 *
 * Level is asserted for every case and is the binding axis: it decides what the
 * system may assert. Intent is asserted where the brief names one that this
 * classifier's taxonomy also has — the brief's labels come from the same domain
 * table, but `fatwa-referral` is a routing outcome in both.
 */
const LEVELS: Record<string, RfeeqLevel> = {
  أ: "a",
  ب: "b",
  ج: "c",
  د: "d",
};

interface Case {
  id: number;
  question: string;
  level: keyof typeof LEVELS;
  intent?: RfeeqIntent;
}

const CASES: Case[] = [
  {
    id: 1,
    question: "لماذا يعبد المسلمون الكعبة؟",
    level: "ب",
    intent: "shubuhat",
  },
  {
    id: 2,
    question: "هل القرآن من تأليف محمد ﷺ؟",
    level: "ب",
    intent: "shubuhat",
  },
  {
    id: 3,
    question: "هل الإسلام انتشر بالسيف؟",
    level: "ج",
    intent: "sira-history",
  },
  {
    id: 4,
    question: "لماذا توجد أحكام مختلفة بين العلماء؟",
    level: "ب",
    intent: "fiqh",
  },
  {
    id: 5,
    question: "أنا في دولة كذا، هل يجوز لي فعل كذا في زواجي؟",
    level: "د",
    intent: "fatwa-referral",
  },
  {
    id: 6,
    question: "أعطني حديثًا يثبت هذا الكلام",
    level: "أ",
    intent: "hadith",
  },
  {
    id: 7,
    question: "ما معنى التوحيد لشخص لم يسمع بالمصطلح من قبل؟",
    level: "ب",
    intent: "aqida",
  },
  {
    id: 8,
    question: "ترجم كلمة التوحيد إلى الإنجليزية",
    level: "أ",
    intent: "terminology",
  },
  {
    id: 9,
    question: "لماذا يمنع الإسلام الخمر؟",
    level: "ب",
    intent: "shubuhat",
  },
  {
    id: 10,
    question: "هل كل المسلمين يتفقون في هذه المسألة؟",
    level: "ج",
  },
];

/*
 * Cases 11 and 12 are **described** in the brief, not quoted:
 * «سؤال يتضمن آية منقولة بخطأ» and «سؤال بلغة غير عربية يتضمن مصطلحًا دينيًا ذا
 * دلالة ثقافية خاصة». There is no question text to classify.
 *
 * They were briefly in the table above with invented questions, and with the
 * levels adjusted until they passed — which tests the implementation against
 * itself and nothing else. They are documented here instead, with the rule each
 * one exercises asserted separately below where it is actually implementable.
 */
const DESCRIBED_ONLY = [
  { id: 11, level: "أ", intent: "quran", why: "no question text is published" },
  {
    id: 12,
    level: "ب",
    intent: "terminology",
    why: "the question is in a non-Arabic language, which this classifier cannot route",
  },
] as const;

describe("routeQuestion — the brief's published cases", () => {
  for (const testCase of CASES) {
    it(`case ${testCase.id}: level (${testCase.level})`, () => {
      expect(routeQuestion(testCase.question).level).toBe(
        LEVELS[testCase.level],
      );
    });

    if (testCase.intent) {
      it(`case ${testCase.id}: intent ${testCase.intent}`, () => {
        expect(routeQuestion(testCase.question).intent).toBe(testCase.intent);
      });
    }
  }

  it("accounts for every one of the twelve", () => {
    const covered = [
      ...CASES.map((c) => c.id),
      ...DESCRIBED_ONLY.map((c) => c.id),
    ].sort((a, b) => a - b);
    expect(covered).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
});

describe("the two axes are independent", () => {
  /*
   * The pair the brief and the draft intent map both use to make the point.
   * Same corpus, same passages; different answer contract. If these two ever
   * classify alike, the level axis has stopped working.
   */
  const general = routeQuestion("ما حكم صلاة المسافر؟");
  const personal = routeQuestion("أنا مسافر غدًا، هل أقصر الصلاة؟");

  it("routes both to the fiqh material", () => {
    expect(general.template).toBe("fatwa");
    expect(personal.template).toBe("fatwa");
  });

  it("separates the category question from the personal case", () => {
    expect(general.level).toBe("b");
    expect(general.isPersonalCase).toBe(false);

    expect(personal.level).toBe("d");
    expect(personal.isPersonalCase).toBe(true);
    expect(personal.intent).toBe("fatwa-referral");
  });
});

describe("level (د) fails safe", () => {
  /*
   * The draft intent map is explicit that this classifier should fail toward
   * (د): a false negative means issuing a fatwa, which is out of scope, while a
   * false positive costs one unnecessary referral. So inside fiqh a personal
   * stake is enough on its own, with no explicit request to decide.
   */
  it.each(["عقدي فيه شرط جزائي", "نسيت التشهد في صلاتي", "زوجتي لم تصم رمضان"])(
    "treats %s as a personal case",
    (question) => {
      expect(routeQuestion(question).level).toBe("d");
    },
  );

  /*
   * Regression. The possessive markers were matched without a right boundary,
   * so «صلاتي» (my prayer) matched inside «الصلاتين» (the two prayers), «مالي»
   * inside «المالية» and «عملي» inside «العملية». Three ordinary level-(ب)
   * questions were being read as somebody's own case and referred away
   * unanswered — an over-referral that looks like caution and is a bug.
   */
  it.each([
    "ما حكم الجمع بين الصلاتين في السفر؟",
    "ما حكم المعاملات المالية في البنوك؟",
    "ما هي العملية الجراحية المباحة؟",
    "ما حكم العقدية في البيع؟",
  ])("does not read %s as a personal case", (question) => {
    const routing = routeQuestion(question);
    expect(routing.isPersonalCase).toBe(false);
    expect(routing.level).not.toBe("d");
  });

  it("does not refer a question that merely mentions the asker", () => {
    // no ruling at stake: this is someone describing what they want to learn
    const routing = routeQuestion("أنا أريد أن أتعلم تفسير القرآن");
    expect(routing.level).not.toBe("d");
  });
});

describe("template selection within one corpus", () => {
  it("separates a hadith's authenticity from its meaning", () => {
    expect(
      routeQuestion("ما صحة حديث «اطلبوا العلم ولو بالصين»؟").template,
    ).toBe("hadith-card");
    expect(
      routeQuestion("اشرح لي حديث «اطلبوا العلم ولو بالصين»").template,
    ).toBe("hadith-explain");
  });

  it("separates the verse from its commentary", () => {
    expect(routeQuestion("اعرض لي الآية 43 من سورة النحل").template).toBe(
      "aya",
    );
    expect(routeQuestion("ما تفسير الآية 43 من سورة النحل؟").template).toBe(
      "tafsir",
    );
  });
});

describe("terminology spans two levels", () => {
  /*
   * The rule behind the brief's cases 8 and 12, which is the part of case 12
   * that can be tested without its (unpublished, non-Arabic) question.
   *
   * Terminology was uniformly level (أ) until these two were read against each
   * other. A dictionary lookup is settled; a term carrying cultural weight that
   * has to be explained in context is not, and treating both as (أ) licenses a
   * confident literal translation of exactly the terms `terminology.md` says
   * must never be collapsed — «الشريعة» into penal law, «الفتوى» into ordinary
   * information.
   */
  it("treats a translation request as settled (أ)", () => {
    const routing = routeQuestion("ترجم كلمة التوحيد إلى الإنجليزية");
    expect(routing.intent).toBe("terminology");
    expect(routing.level).toBe("a");
  });

  it("treats a request for a term's meaning as (ب)", () => {
    const routing = routeQuestion("ما معنى مصطلح الفتوى بالإنجليزية؟");
    expect(routing.intent).toBe("terminology");
    expect(routing.level).toBe("b");
  });
});

/**
 * Patterns are tested against normalised text, so they have to be written in
 * normalised form.
 *
 * `normalise` folds «ى» to «ي» and «ة» to «ه». A term written «معنى» therefore
 * matched nothing at all: by the time the pattern ran, the question said
 * «معني». Six terms were written that way, and every «ما معنى …» question fell
 * through the rules meant to catch it. The compiler now folds each term the
 * same way the input is folded; these are the cases that were silently wrong.
 */
/**
 * The brief excludes four things from scope, not one.
 *
 * Page 2: «ولا يدخل في النطاق إصدار الفتوى الشخصية المستقلة، أو الحكم على
 * الأشخاص والجماعات، أو معالجة النزاعات الخاصة، أو بناء أحكام شرعية على وقائع
 * فردية غير متحققة». Only the first had a guard; these cover the other three.
 */
describe("the four scope exclusions", () => {
  it.each([
    ["هل جارنا هذا كافر؟", "persons-groups"],
    ["ما حكم جماعة كذا، هل هم كفار؟", "persons-groups"],
    ["هل فلان مبتدع؟", "persons-groups"],
    ["بيني وبين شريكي نزاع على المال، لمن الحق؟", "private-dispute"],
    ["عندي خصومة مع أخي في الميراث، ماذا أفعل؟", "private-dispute"],
    ["نسيت سجدة في صلاتي، هل أعيد؟", "personal-case"],
    ["لو أن رجلًا طلّق زوجته ثلاثًا، ما حكم ذلك؟", "hypothetical"],
  ])("routes %s to %s", (question, exclusion) => {
    const routing = routeQuestion(question);
    expect(routing.exclusion).toBe(exclusion);
    // every exclusion is level (د): the general material is owed, the
    // particular judgement is withheld
    expect(routing.level).toBe("d");
  });

  /*
   * A verdict on a named person outranks a personal-case reading when both
   * fire. «هل أبي كافر؟» is literally about the asker's family and is first of
   * all a request to rule on a person, which is the graver exclusion.
   */
  it("ranks a verdict on a person above the asker's own case", () => {
    expect(routeQuestion("هل أبي كافر؟").exclusion).toBe("persons-groups");
  });

  /*
   * The exclusion is on the verdict, not on the topic. The brief approves
   * answering doctrinal questions about these very concepts — and test case 4
   * («لماذا توجد أحكام مختلفة بين العلماء؟») depends on that distinction
   * holding.
   */
  it.each([
    "ما معنى التكفير في الشرع؟",
    "ما ضوابط التكفير عند أهل السنة؟",
    "ما معنى النفاق؟",
    "ما حكم صلاة المسافر؟",
    "ما أركان الإيمان؟",
  ])("leaves the doctrinal question in scope: %s", (question) => {
    expect(routeQuestion(question).exclusion).toBeNull();
  });

  /*
   * «لو» alone is a pleasantry, not a supposition, and a supposed case still
   * needs a ruling request before the contract applies — otherwise «ماذا لو
   * قرأت القرآن كله؟» would be refused as a hypothetical.
   */
  it("does not read a bare لو as a supposed case", () => {
    expect(routeQuestion("لو سمحت، ما أركان الإسلام؟").exclusion).toBeNull();
  });
});

describe("patterns are folded the way the input is", () => {
  it.each([
    ["ما معنى قوله تعالى وجادلهم بالتي هي أحسن؟", "tafsir"],
    ["ما معنى كلمة «أبّا» في القرآن؟", "tafsir"],
    ["ما معنى مصطلح الإحصان؟", "terminology"],
  ])("routes %s to %s", (question, intent) => {
    expect(routeQuestion(question).intent).toBe(intent);
  });

  /*
   * The explained thing carried a mandatory definite article, so «تفسير الآية»
   * routed to commentary and «تفسير آية الكرسي» — the same question — routed to
   * the bare-Qurʾān rule, which offers no commentary tool at all.
   */
  it("routes commentary whether or not the explained thing takes an article", () => {
    expect(routeQuestion("ما تفسير الآية 255 من سورة البقرة؟").intent).toBe(
      "tafsir",
    );
    expect(routeQuestion("ما تفسير آية الكرسي؟").intent).toBe("tafsir");
  });
});

describe("known limitations", () => {
  /*
   * Asserted rather than left implicit, so a future change that appears to fix
   * this has to come here and say so. The brief's case 12 is explicitly a
   * question in another language; these patterns are Arabic, so it falls
   * through to the broadest domain instead of being routed.
   */
  it("cannot route a non-Arabic question", () => {
    expect(routeQuestion("What does tawhid mean in Islam?").intent).toBe(
      "dawa",
    );
  });
});
