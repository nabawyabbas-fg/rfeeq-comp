import type { RfeeqIconName } from "@/components/rfeeq/icon-sprite";

import { INTENT_ICON, routeQuestion } from "./intent";
import { versesExist } from "./quran-surahs";

/**
 * The three ways in, offered before the reader has asked anything.
 *
 * Written rather than fixed, for the same reason the follow-ups are: a list
 * that never changes stops being a suggestion and becomes furniture. But this
 * one is the *first* thing a reader sees, so it is generated under tighter
 * constraints than the follow-ups are — the home screen is a poor place to
 * discover that a suggested question happens to be one the system answers
 * badly.
 *
 * Three constraints keep the chips themselves identical whatever the model
 * writes:
 *
 * - **The icon is never the model's.** It comes from `routeQuestion`, so a chip
 *   carrying the Qurʾān mark is one the router will actually send to the
 *   Qurʾān. A model asked to pick the icon could label a fiqh question with a
 *   muṣḥaf and the chip would be lying before it was pressed.
 * - **The label is capped.** The row is three chips wide and a long label wraps
 *   it; an overlong one is dropped rather than truncated, since half a label is
 *   worse than a known-good one.
 * - **The three cover three corpora**, which is what the trio is for — showing
 *   that a verse, a report and a ruling are handled differently.
 */

export interface Starter {
  /** The chip's text — short, because the row is three wide. */
  label: string;
  /** The question actually asked when it is pressed. */
  question: string;
  icon: RfeeqIconName;
}

/** Three. A fourth makes a menu of what should read as an invitation. */
export const MAX_STARTERS = 3;

/**
 * The chip row fits three labels; past this it wraps.
 *
 * Measured against the longest of the curated set — «الجمع والقصر في السفر»,
 * 22 characters — with a little room above it.
 */
const LABEL_MAX = 28;

/**
 * A quotation long enough to be a matn rather than a turn of phrase.
 *
 * Eight characters clears «قال» and «عن أبي» without reaching for anything a
 * real matn would fall short of — «إنما الأعمال بالنيات» is twenty.
 */
const MATN = /[«"“][^»"”]{8,}[»"”]/u;

/**
 * What is shown instantly, and what stays if generation fails.
 *
 * These are known-good: each is a question this system answers well, which is
 * the property a first impression needs and a generated set cannot promise.
 */
export const CURATED: Starter[] = [
  {
    label: "اشرح الآية",
    icon: "quran",
    question: "ما تفسير الآية 43 من سورة النحل؟",
  },
  {
    label: "تحقّق من الحديث",
    icon: "hadith",
    question: "ما صحة حديث «اطلبوا العلم ولو بالصين»؟",
  },
  {
    label: "الجمع والقصر في السفر",
    icon: "library",
    question: "ما أحكام الجمع والقصر في السفر؟",
  },
];

const MODEL = "gpt-4.1-mini";

const INSTRUCTIONS = `أنت تقترح أسئلة افتتاحية لأداة بحث في المحتوى الإسلامي، تُعرض قبل أن يسأل القارئ شيئًا.

اكتب ستة أسئلة، كل واحد في سطر مستقل بهذه الصيغة بالضبط:
العنوان | السؤال

قواعد:
- **العنوان** عبارة قصيرة جدًّا لا تتجاوز ٢٥ حرفًا، تصلح أن تُكتب على زرّ: «اشرح الآية»، «تحقّق من الحديث». وليس سؤالًا ولا جملة تامة.
- **السؤال** هو ما يُرسَل فعلًا: مكتمل، مباشر، بالعربية الفصيحة، ويسمّي ما يسأل عنه صراحةً — «ما تفسير الآية ٤٣ من سورة النحل؟» لا «ما تفسير هذه الآية؟».
- نوّع المجالات: اجعل منها ما يسأل عن آية وتفسيرها، وما يسأل عن حديث ودرجته، وما يسأل عن مسألة فقهية عامة، وما يسأل عن معنى لفظ.
- **سؤال الحديث يذكر لفظ الحديث نفسه بين «»** — «ما صحة حديث «إنما الأعمال بالنيات»؟». ولا تقل «حديث عائشة» ولا «حديث أبي هريرة»: الراوي روى ألوفًا، فالسؤال عن راوٍ وحده سؤالٌ لا جواب له.
- **وسؤال الآية يسمّي السورة ورقم الآية** أو يسمّي الآية باسمها المشهور.
- **نوّع في كل مرة.** لا تقتصر على أشهر الأمثلة — آية الكرسي، سورة الإخلاص، حديث النيات — فالقارئ يرى هذه الاقتراحات في كل زيارة، وتكرارُ المثال نفسه يجعلها أثاثًا لا دعوة. اختر من القرآن كله ومن كتب السنة ما يصلح للسؤال.
- اقتصر على ما يمكن الإجابة عنه من كتب التفسير والحديث والفقه المعتمدة، واختر المشهور المتداول لا الغريب النادر.
- **لا تذكر رقم آية إلا إذا كنت على يقين من وجودها في سورتها** — ورقمُ آيةٍ لا وجود لها يجعل الاقتراح سؤالًا لا جواب له. وإن شككت فاسأل عن الآية بوصفها لا برقمها («آية الكرسي»، «آية الدَّين»)، أو اسأل عن السورة كلها.
- **لا تقترح سؤالًا عن حالة شخصية** («هل يجوز لي…»، «ماذا أفعل إن…») ولا سؤالًا يطلب حكمًا على شخص أو جماعة؛ فالنظام لا يُفتي في الحالات الخاصة ولا يحكم على المعيَّنين.
- لا ترقّم السطور ولا تضف أي نص آخر.`;

/**
 * Reads `label | question` lines into starters the chip row can take.
 *
 * Everything the model could get wrong about the *chip* is decided here rather
 * than asked for: the icon from the router, the label by length, and personal
 * cases dropped outright. A suggested question is a button the reader will
 * press, so offering one that ends in a referral wastes the press.
 */
export const parseStarters = (text: string): Starter[] =>
  text
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .flatMap((line) => {
      const [label, question] = line.split("|").map((part) => part.trim());
      if (!label || !question) return [];
      if (label.length > LABEL_MAX) return [];
      if (question.length < 8 || question.length > 120) return [];

      /*
       * A verse the model invented is dropped outright.
       *
       * It offered «ما تفسير الآية 25 من سورة الحجرات؟», and الحجرات has 18
       * āyāt. Nothing downstream would have caught it: retrieval comes back
       * empty and the answer becomes an apology — on the first screen, about
       * the Qurʾān, from a button the reader was invited to press. The counts
       * are fixed facts, so this is checked rather than trusted.
       */
      if (!versesExist(question)) return [];

      const routing = routeQuestion(question);
      if (routing.exclusion) return [];

      /*
       * A hadith question that names only its narrator is unanswerable.
       *
       * It offered «تحقّق من حديث عائشة» — عائشة narrated more than two
       * thousand, so there is no report for the system to look up and no answer
       * for the reader to get. A hadith is identified by its matn, so the
       * question has to carry it.
       */
      if (routing.intent === "hadith" && !MATN.test(question)) return [];

      return [{ label, question, icon: INTENT_ICON[routing.intent] }];
    });

/**
 * Picks the three shown, one corpus each where the candidates allow.
 *
 * Diversity first, order second: three Qurʾānic suggestions would be a worse
 * row than three unrelated ones, because the trio exists to show that the three
 * kinds of question are handled differently. Short of three distinct icons it
 * fills from what is left, then from the curated set — so the row is always
 * three chips, which is the UI contract.
 */
export const pickStarters = (candidates: Starter[]): Starter[] => {
  const chosen: Starter[] = [];
  const icons = new Set<RfeeqIconName>();

  for (const starter of candidates) {
    if (chosen.length >= MAX_STARTERS) break;
    if (icons.has(starter.icon)) continue;
    icons.add(starter.icon);
    chosen.push(starter);
  }
  for (const starter of candidates) {
    if (chosen.length >= MAX_STARTERS) break;
    if (!chosen.includes(starter)) chosen.push(starter);
  }
  for (const starter of CURATED) {
    if (chosen.length >= MAX_STARTERS) break;
    if (!chosen.some((item) => item.question === starter.question)) {
      chosen.push(starter);
    }
  }
  return chosen.slice(0, MAX_STARTERS);
};

/**
 * Writes a fresh set, or returns the curated one.
 *
 * Never throws and never returns fewer than three: this runs for the opening
 * screen, where an empty row would read as the app having failed to load.
 */
export const generateStarters = async (
  apiKey?: string,
): Promise<Starter[]> => {
  if (!apiKey) return CURATED;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        instructions: INSTRUCTIONS,
        input: "اكتب الأسئلة الافتتاحية.",
        // higher than the follow-ups' 0.4: these have no context to be faithful
        // to, and the whole point is that two visits do not look the same
        temperature: 0.9,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return CURATED;

    const payload = (await response.json()) as {
      output?: { type?: string; content?: { text?: string }[] }[];
    };
    const text = (payload.output ?? [])
      .filter((item) => item.type === "message")
      .flatMap((item) => item.content ?? [])
      .map((content) => content.text ?? "")
      .join("");

    const picked = pickStarters(parseStarters(text));
    return picked.length === MAX_STARTERS ? picked : CURATED;
  } catch {
    return CURATED;
  }
};
