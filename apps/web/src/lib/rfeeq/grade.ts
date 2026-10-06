import { normalise } from "./normalise";

/**
 * Which side of the bipolar scale a hadith's grading falls on.
 *
 * The MVP specification asks for a deliberately two-valued display for the
 * non-specialist — «نظام ثنائي واضح ومباشر يعتمد أقسام الدرر السنية الأربعة،
 * لتقليل الحاجز الذهني» — green for الأحاديث الصحيحة وما في حكمها together with
 * الأحاديث التي أسانيدها صحيحة, red for الضعيفة وما في حكمها together with
 * الأحاديث التي أسانيدها ضعيفة. Yellow and black are reserved for a specialist
 * view that does not exist yet.
 *
 * Two values is a presentation decision, not a scholarly one, and the
 * difference matters: **the grading's own words are always shown**. The colour
 * is a reading aid on top of «حسن لغيره», never a replacement for it. Reducing
 * a grading to a colour would be exactly the rewording the brief forbids —
 * «لا تُعِد صياغة الحكم».
 */
export type GradeTone = "sound" | "weak" | "unknown";

/*
 * Matched against the normalised grading, longest-first within each list so
 * «ضعيف جدا» is recognised before «ضعيف» — not because the tone differs, but
 * because a prefix match on a shorter term would make the list's order load
 * bearing for no reason.
 */
const SOUND = [
  "صحيح لغيره",
  "صحيح الاسناد",
  "اسناده صحيح",
  "حسن لغيره",
  "اسناده حسن",
  "متفق عليه",
  "صحيح",
  "حسن",
  "ثابت",
  "جيد",
];

const WEAK = [
  "ضعيف جدا",
  "ضعيف الاسناد",
  "اسناده ضعيف",
  "لا اصل له",
  "لا يصح",
  "غير ثابت",
  "لم يثبت",
  "موضوع",
  "مكذوب",
  "باطل",
  "منكر",
  "شاذ",
  "معلول",
  "ضعيف",
];

/**
 * A negated positive.
 *
 * Checked before everything else, and the reason is a bug worth remembering:
 * «غير صحيح» contains «صحيح», so any order of plain substring tests reads it as
 * sound and paints a weak hadith green. Term lists cannot fix that by growing —
 * every positive grading has a negated form — so the negation is matched as a
 * negation.
 *
 * Tested against normalised text, where «ليس بصحيحٍ» has already become
 * «ليس بصحيح».
 */
const NEGATED =
  /(?:غير|ليس|لا|لم)\s*(?:ب)?\s*(?:صحيح|حسن|ثابت|يصح|يثبت|محفوظ)/u;

/**
 * Reads a grading's tone, or returns `unknown`.
 *
 * `unknown` is a real outcome and not a failure: the encyclopedias carry
 * gradings this list does not anticipate — a muḥaddith's sentence rather than a
 * single word, «قال النووي: فيه كلام» — and colouring one of those by guesswork
 * would assert something the data did not say. An unrecognised grading renders
 * in its own words with no colour, which is honest and still complete.
 *
 * Weak before sound among the lists too, since «ضعيف الإسناد» should not have
 * to depend on «صحيح» being absent from it.
 */
export const gradeTone = (grade: string | null | undefined): GradeTone => {
  if (!grade?.trim()) return "unknown";
  const text = normalise(grade);

  if (NEGATED.test(text)) return "weak";
  if (WEAK.some((term) => text.includes(normalise(term)))) return "weak";
  if (SOUND.some((term) => text.includes(normalise(term)))) return "sound";
  return "unknown";
};
