/**
 * Folds the spelling variation that stops a typed Arabic name matching a
 * catalogue entry.
 *
 * A reader types `بن القيم`; the catalogue holds `ابن القيم`. Neither is wrong,
 * and an exact match finds nothing. The folds here are the ones that actually
 * separate the two in practice — they are not a general-purpose normaliser, and
 * deliberately do not touch letters whose difference can be meaningful
 * (ة/ه, ى/ي are left alone, since `التقوى` and `التقوي` are different words).
 */
export const normalizeArabicName = (input: string): string =>
  input
    // harakat and tatweel: decoration, never distinguishing
    .replace(/[ً-ْـ]/g, "")
    // hamza carriers: أ إ آ are all typed for the same alif
    .replace(/[أإآ]/g, "ا")
    // `ابن` and `بن` are the same word, written both ways
    .replace(/\bابن\b/g, "بن")
    // the definite article is dropped as often as it is typed
    .replace(/(^|\s)ال/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
