/**
 * The 114 sūras, with the number of āyāt in each.
 *
 * Read once from مركز تفسير's `get_surah_statistics` and written down rather
 * than fetched, because these are fixed facts: the count of āyāt in a sūra does
 * not change, and a validity check that needs the network is one that fails
 * open the moment the network does. The totals agree with the same server's
 * `get_quran_overview` — 114 sūras, 6236 āyāt — which is the check that the
 * transcription is complete and in order.
 *
 * Here to answer one question: *does this verse exist?* A generated opening
 * suggestion offered «ما تفسير الآية 25 من سورة الحجرات؟», and الحجرات has 18
 * āyāt. The chip was a button that could not be answered, on the first screen,
 * about the Qurʾān — the single worst place in this product to be confidently
 * wrong. Nothing downstream could have caught it: retrieval would simply come
 * back empty and the model would apologise.
 */

export interface Surah {
  /** 1-114, as the muṣḥaf orders them. */
  number: number;
  /** The name without the word «سورة», as مركز تفسير spells it. */
  name: string;
  /** عدد الآيات. */
  ayahs: number;
}

/** `[number, name, ayahs]`, in muṣḥaf order. */
const TABLE: [number, string, number][] = [
  [1, "الفاتحة", 7],
  [2, "البقرة", 286],
  [3, "آل عمران", 200],
  [4, "النساء", 176],
  [5, "المائدة", 120],
  [6, "الأنعام", 165],
  [7, "الأعراف", 206],
  [8, "الأنفال", 75],
  [9, "التوبة", 129],
  [10, "يونس", 109],
  [11, "هود", 123],
  [12, "يوسف", 111],
  [13, "الرعد", 43],
  [14, "إبراهيم", 52],
  [15, "الحجر", 99],
  [16, "النحل", 128],
  [17, "الإسراء", 111],
  [18, "الكهف", 110],
  [19, "مريم", 98],
  [20, "طه", 135],
  [21, "الأنبياء", 112],
  [22, "الحج", 78],
  [23, "المؤمنون", 118],
  [24, "النور", 64],
  [25, "الفرقان", 77],
  [26, "الشعراء", 227],
  [27, "النمل", 93],
  [28, "القصص", 88],
  [29, "العنكبوت", 69],
  [30, "الروم", 60],
  [31, "لقمان", 34],
  [32, "السجدة", 30],
  [33, "الأحزاب", 73],
  [34, "سبإ", 54],
  [35, "فاطر", 45],
  [36, "يس", 83],
  [37, "الصافات", 182],
  [38, "ص", 88],
  [39, "الزمر", 75],
  [40, "غافر", 85],
  [41, "فصلت", 54],
  [42, "الشورى", 53],
  [43, "الزخرف", 89],
  [44, "الدخان", 59],
  [45, "الجاثية", 37],
  [46, "الأحقاف", 35],
  [47, "محمد", 38],
  [48, "الفتح", 29],
  [49, "الحجرات", 18],
  [50, "ق", 45],
  [51, "الذاريات", 60],
  [52, "الطور", 49],
  [53, "النجم", 62],
  [54, "القمر", 55],
  [55, "الرحمن", 78],
  [56, "الواقعة", 96],
  [57, "الحديد", 29],
  [58, "المجادلة", 22],
  [59, "الحشر", 24],
  [60, "الممتحنة", 13],
  [61, "الصف", 14],
  [62, "الجمعة", 11],
  [63, "المنافقون", 11],
  [64, "التغابن", 18],
  [65, "الطلاق", 12],
  [66, "التحريم", 12],
  [67, "الملك", 30],
  [68, "القلم", 52],
  [69, "الحاقة", 52],
  [70, "المعارج", 44],
  [71, "نوح", 28],
  [72, "الجن", 28],
  [73, "المزمل", 20],
  [74, "المدثر", 56],
  [75, "القيامة", 40],
  [76, "الإنسان", 31],
  [77, "المرسلات", 50],
  [78, "النبإ", 40],
  [79, "النازعات", 46],
  [80, "عبس", 42],
  [81, "التكوير", 29],
  [82, "الانفطار", 19],
  [83, "المطففين", 36],
  [84, "الانشقاق", 25],
  [85, "البروج", 22],
  [86, "الطارق", 17],
  [87, "الأعلى", 19],
  [88, "الغاشية", 26],
  [89, "الفجر", 30],
  [90, "البلد", 20],
  [91, "الشمس", 15],
  [92, "الليل", 21],
  [93, "الضحى", 11],
  [94, "الشرح", 8],
  [95, "التين", 8],
  [96, "العلق", 19],
  [97, "القدر", 5],
  [98, "البينة", 8],
  [99, "الزلزلة", 8],
  [100, "العاديات", 11],
  [101, "القارعة", 11],
  [102, "التكاثر", 8],
  [103, "العصر", 3],
  [104, "الهمزة", 9],
  [105, "الفيل", 5],
  [106, "قريش", 4],
  [107, "الماعون", 7],
  [108, "الكوثر", 3],
  [109, "الكافرون", 6],
  [110, "النصر", 3],
  [111, "المسد", 5],
  [112, "الإخلاص", 4],
  [113, "الفلق", 5],
  [114, "الناس", 6],
];

export const SURAHS: Surah[] = TABLE.map(([number, name, ayahs]) => ({
  number,
  name,
  ayahs,
}));

/**
 * Folds the spellings a name is written in.
 *
 * Deliberately not `normalise` from `intent.ts`: that one folds ى→ي and ة→ه for
 * routing, which is right there and wrong here — «طه» and «طه» are fine but
 * folding would also have to survive «الضحى». What a name actually varies by is
 * hamza seating (آل/ال, الأعراف/الاعراف), the definite article, and diacritics,
 * so those are what this folds and nothing else.
 */
const fold = (name: string) =>
  name
    .trim()
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/\s+/g, " ");

/** Both spellings a sūra is named by: «النحل» and «نحل». */
const keys = (name: string) => {
  const folded = fold(name);
  const bare = folded.replace(/^ال/, "");
  return bare && bare !== folded ? [folded, bare] : [folded];
};

const BY_NAME = new Map<string, Surah>();
for (const surah of SURAHS) {
  for (const key of keys(surah.name)) BY_NAME.set(key, surah);
}

/** Looks a sūra up by name, with or without its article. */
export const surahByName = (name: string): Surah | null =>
  BY_NAME.get(fold(name)) ?? BY_NAME.get(fold(name).replace(/^ال/, "")) ?? null;

/** Looks a sūra up by its number in the muṣḥaf. */
export const surahByNumber = (number: number): Surah | null =>
  SURAHS[number - 1] ?? null;

/**
 * A verse reference found in a question, with the sūra resolved.
 *
 * `surah` is null when the name is not one of the 114 — which is itself a
 * finding, not a parse failure: a suggestion naming a sūra that does not exist
 * is as unanswerable as one naming a verse that does not.
 */
export interface VerseReference {
  name: string;
  surah: Surah | null;
  ayah: number;
}

/** ٠-٩ as well as 0-9, since a question may be typed either way. */
const digits = (text: string) =>
  Number(text.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))));

/**
 * «الآية 25 من سورة الحجرات» and «سورة الحجرات، الآية 25» — both orders, since
 * either is a natural way to write it and a check that only sees one of them
 * lets the other through.
 *
 * The name runs to two words so «آل عمران» survives, and stops at punctuation.
 */
const NAME = "([^\\s؟?,.،:\\d]+(?:\\s+[^\\s؟?,.،:\\d]+)?)";
const NUM = "([\\d٠-٩]+)";
const PATTERNS = [
  new RegExp(`(?:ال)?[آاأ]ي[ةه]\\s*${NUM}\\s*من\\s*سور[ةه]\\s*${NAME}`, "gu"),
  new RegExp(`سور[ةه]\\s*${NAME}[\\s،,]*(?:ال)?[آاأ]ي[ةه]\\s*${NUM}`, "gu"),
];

/** Every verse reference in a text, in the order they appear. */
export const verseReferences = (text: string): VerseReference[] => {
  const found: VerseReference[] = [];

  for (const [index, pattern] of PATTERNS.entries()) {
    for (const match of text.matchAll(pattern)) {
      // the two patterns capture in opposite orders
      const [name, ayah] =
        index === 0 ? [match[2], match[1]] : [match[1], match[2]];
      if (!name || !ayah) continue;

      const surah = surahByName(name);
      // a trailing «في» or «عند» swept up by the two-word name
      const trimmed = surah ? surah : surahByName(name.split(/\s+/)[0] ?? "");
      found.push({ name, surah: trimmed, ayah: digits(ayah) });
    }
  }
  return found;
};

/**
 * Whether every verse a text names actually exists.
 *
 * True for a text that names none — this asks "is anything here wrong?", not
 * "is there a citation?", and the two must not be confused: most questions name
 * no verse at all and are perfectly answerable.
 */
export const versesExist = (text: string): boolean =>
  verseReferences(text).every(
    (ref) => ref.surah !== null && ref.ayah >= 1 && ref.ayah <= ref.surah.ayahs,
  );
