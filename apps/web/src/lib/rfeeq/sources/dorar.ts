import type { FormattedChunk } from "@/lib/agentic-search/format-chunk";

import { gradeTone } from "../grade";
import { searchApprovedWeb } from "./web-search";

/**
 * الموسوعة الحديثية — الدرر السنية.
 *
 * The brief names `dorar.net/hadith` in the hadith row of the allow-list, and
 * it is the only approved platform that carries **the muḥaddiths' own rulings**:
 * موسوعة الحديث gives a matn with one grading and one attribution, while Dorar
 * gives every ruling passed on that matn, each with who narrated it, who graded
 * it, the book it was graded in, the page, and the takhrīj.
 *
 * It was already reachable — `WEB_DOMAINS.hadith` includes `dorar.net` and the
 * approved web search carries it, because Dorar's own CDN refuses this server's
 * address outright (403 from Cloudflare, with or without a browser agent, so
 * its published JSON endpoint is closed to us too). What was missing is that
 * consulting it was left to the model, which stops as soon as the encyclopedia
 * answers: the conversation that prompted this called `hadith_search` and
 * `read_sources` and nothing else. Dorar is mandatory, so this runs with the
 * read rather than being offered as an option beside it.
 *
 * Every field is copied, never rewritten. «خلاصة حكم المحدث» is the muḥaddith's
 * verdict in the muḥaddith's words, and the brief's rule for hadith — «لا ينسب
 * حديث دون مصدر وحكم معتمد» — is about exactly these two fields travelling
 * together.
 */

/** One muḥaddith's ruling on one matn, as الموسوعة الحديثية records it. */
export interface DorarRuling {
  /** الراوي — the Companion the report is narrated from. */
  narrator?: string;
  /** المحدث — the scholar whose ruling this is. */
  muhaddith?: string;
  /** المصدر — the book the ruling was given in. */
  source?: string;
  /** الصفحة أو الرقم. */
  locus?: string;
  /** خلاصة حكم المحدث, in the muḥaddith's own words. */
  grade?: string;
  /** التخريج — who else recorded it, and with what wording. */
  takhrij?: string;
  /** The Dorar page this was read from. */
  url?: string;
}

/**
 * Dorar's field labels, in the spelling its pages use.
 *
 * Order matters only for the scan: a ruling runs from one label to the next, so
 * the set has to be complete or a field swallows the one after it. «الصفحة أو
 * الرقم» must be tried before «الصفحة» would be, which is why there is no bare
 * «الصفحة» here at all.
 */
const FIELDS: { key: keyof DorarRuling; label: string }[] = [
  { key: "narrator", label: "الراوي" },
  { key: "muhaddith", label: "المحدث" },
  { key: "source", label: "المصدر" },
  { key: "locus", label: "الصفحة أو الرقم" },
  { key: "grade", label: "خلاصة حكم المحدث" },
  { key: "takhrij", label: "التخريج" },
];

/**
 * `الراوي : ` — the label, **a space**, then the colon.
 *
 * That space is the whole discriminator, and it is load-bearing. The approved
 * web search returns two kinds of text for one page: Dorar's ruling block
 * quoted verbatim, and the search model's own summary of it — «- **الراوي**:
 * عمر بن الخطاب رضي الله عنه - **المحدثون** وتوثيقاتهم: - الألباني، حكمه:
 * صحيح». Both carry the same labels and the same colons, and parsing the second
 * presents a model's paraphrase as the muḥaddith's recorded ruling, which is
 * the one thing this system must never do.
 *
 * Dorar's own pages write `label` space `:` space `value`; prose writes
 * `label:`. So the space is required, and a label sitting inside markdown
 * emphasis is refused outright. It fails in the safe direction: a change in
 * Dorar's spacing yields fewer rulings, never invented ones.
 */
const LABELS = new RegExp(
  `(?<![*\\p{L}\\p{M}])(${FIELDS.map((f) => f.label).join("|")})\\s+[:：]\\s*`,
  "gu",
);

/** Trailing separators and the quotation furniture the search wraps text in. */
const tidy = (value: string) =>
  value
    .replace(/[—–-]\s*نقلًا حرفيًّا[\s\S]*$/u, "")
    // the search elides between fields, and the ellipsis belongs to neither
    .replace(/\s*(?:\.{3,}|…)\s*$/u, "")
    .replace(/["»«”“]+\s*$/u, "")
    .replace(/[|｜—–\-،,]\s*$/u, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Reads every ruling out of a Dorar page's text.
 *
 * Scans label positions and slices between them rather than splitting on «|» or
 * on newlines, because the page runs fields together — «المصدر : غاية المرام
 * الصفحة أو الرقم : 14» arrives on one line with no separator at all, and a
 * split would put the page number inside the book's name.
 *
 * A new ruling starts wherever a field repeats: Dorar lists the same matn once
 * per muḥaddith, so the second «الراوي» is the second ruling, not a correction
 * of the first.
 */
export const parseDorarRulings = (text: string): DorarRuling[] => {
  const marks = [...text.matchAll(LABELS)];
  if (marks.length === 0) return [];

  const rulings: DorarRuling[] = [];
  let current: DorarRuling = {};

  marks.forEach((mark, index) => {
    const field = FIELDS.find((f) => f.label === mark[1]);
    if (!field) return;

    const start = mark.index + mark[0].length;
    const end = marks[index + 1]?.index ?? text.length;
    const value = tidy(text.slice(start, end));
    if (!value) return;

    // a field seen twice means the next ruling has begun
    if (current[field.key] !== undefined) {
      rulings.push(current);
      current = {};
    }
    current[field.key] = value;
  });

  if (Object.keys(current).length > 0) rulings.push(current);

  /*
   * A ruling with no grading is not a ruling. Dorar's own pages carry narrator
   * lines in running prose that the scan would otherwise promote into entries,
   * and the brief's requirement is a source *and* an accredited grading
   * together — half of one is worse than none.
   */
  return rulings.filter((ruling) => ruling.grade && ruling.muhaddith);
};

/**
 * What makes two entries the same ruling.
 *
 * Deliberately not the page number. A search returns the same ruling from
 * several Dorar pages — الألباني's verdict in غاية المرام came back at both
 * «14» and «401» — and listing one muḥaddith twice with the same verdict reads
 * as a bug rather than as two citations. The muḥaddith, the book and the
 * verdict identify the ruling; where it is printed is detail, and the first
 * one seen keeps its place.
 */
const key = (ruling: DorarRuling) =>
  [ruling.muhaddith, ruling.source, ruling.grade]
    .map((part) => (part ?? "").replace(/[\p{P}\s]+/gu, " ").trim())
    .join("|");

export interface DorarHadith {
  rulings: DorarRuling[];
  /** The pages the rulings were read from, for the sources list. */
  chunks: FormattedChunk[];
}

/**
 * Asks الموسوعة الحديثية about one matn.
 *
 * The query names the fields wanted so the search returns the ruling block
 * rather than the page's prose — without it the extract comes back as the
 * article's introduction, which carries no grading at all.
 *
 * Never throws: the hadith still has موسوعة الحديث's own grading, and a failed
 * enrichment must not take the answer down with it.
 */
/**
 * The matn, without the chain that introduces it.
 *
 * موسوعة الحديث returns a hadith as it is narrated — «عن عمر بن الخطاب رضي الله
 * عنه قال: قال رسول الله صلى الله عليه وسلم: «إنما الأعمال بالنية…»» — and the
 * first hundred characters of that are mostly isnād. Dorar is searched on the
 * Prophet's own words, which is what its index is keyed on, so the quoted span
 * is used when there is one.
 */
const matnOf = (text: string) =>
  (/«([^»]{10,})»/u.exec(text)?.[1] ?? text).trim();

export const fetchDorarHadith = async (
  text: string,
  apiKey?: string,
): Promise<DorarHadith> => {
  const matn = matnOf(text);
  if (!apiKey || !matn) return { rulings: [], chunks: [] };

  try {
    const { chunks } = await searchApprovedWeb(
      `حديث «${matn.slice(0, 120)}» في الموسوعة الحديثية: ` +
        `الراوي والمحدث والمصدر والصفحة أو الرقم وخلاصة حكم المحدث والتخريج`,
      ["dorar.net"],
      apiKey,
    );

    /*
     * Parsed per **page**, not per excerpt.
     *
     * One Dorar ruling block — الراوي، المحدث، المصدر، الصفحة، خلاصة الحكم —
     * can come back as several excerpts, because the search marks each verbatim
     * quotation separately and may break a block across two of them. Read one
     * excerpt at a time, a block split that way loses every ruling: the half
     * holding the narrator has no verdict and the half holding the verdict has
     * no muḥaddith, and the filter drops both.
     *
     * Grouped by document id rather than joined wholesale, so a narrator from
     * one page can never be paired with a verdict from another. That would be a
     * ruling nobody made.
     */
    const byPage = new Map<string, { url?: string; text: string[] }>();
    for (const chunk of chunks) {
      const page = byPage.get(chunk.documentId) ?? {
        url: str(chunk.metadata?.sourceUrl),
        text: [],
      };
      page.text.push(chunk.text);
      byPage.set(chunk.documentId, page);
    }

    const seen = new Set<string>();
    const rulings: DorarRuling[] = [];
    const graded = new Map<string, DorarRuling[]>();

    for (const [documentId, page] of byPage) {
      const read = parseDorarRulings(page.text.join("\n"));
      if (read.length > 0) graded.set(documentId, read);

      for (const ruling of read) {
        const id = key(ruling);
        if (seen.has(id)) continue;
        seen.add(id);
        rulings.push(page.url ? { ...ruling, url: page.url } : ruling);
      }
    }

    /*
     * The grading, attached to the page it was read from.
     *
     * Without this a hadith that موسوعة الحديث does not hold — and Dorar's
     * reason for being in the allow-list is precisely that it carries those —
     * reaches the answer with no structured grading anywhere. The «درجة الحديث»
     * section then has no chunk to render from, falls back to the model's own
     * prose, and a reader sees the word «حسن» set as ordinary text with no
     * grading badge and no colour.
     *
     * Only when the page's rulings **agree**. A single coloured badge over a
     * matn that النووي called حسن and ابن عدي called ضعيف would be the
     * interface taking a side the sources have not; a disputed grading belongs
     * in أحكام المحدّثين, stated by each muḥaddith in turn, and the section
     * falls back to prose — which is the honest rendering of a disagreement.
     */
    const marked = chunks.map((chunk) => {
      const read = graded.get(chunk.documentId);
      if (!read || read.length === 0) return chunk;

      const tones = new Set(read.map((ruling) => gradeTone(ruling.grade)));
      const agreed =
        tones.size === 1 && !tones.has("unknown") ? read[0] : undefined;

      return {
        ...chunk,
        metadata: {
          ...chunk.metadata,
          rulings: read,
          ...(agreed?.grade && {
            grade: agreed.grade,
            // the verdict is that muḥaddith's, and is shown as such
            ...(agreed.muhaddith && { attribution: agreed.muhaddith }),
          }),
        },
      };
    });

    return { rulings, chunks: marked };
  } catch {
    return { rulings: [], chunks: [] };
  }
};

const str = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

/** How many hadith in one read are enriched. A read asks for at most five. */
const MAX_ENRICHED = 3;

/**
 * Attaches الدرر السنية's rulings to every hadith in a read.
 *
 * Runs with the read rather than beside it, which is the whole point: the brief
 * makes `dorar.net/hadith` part of the hadith row, and a source consulted only
 * when the model remembers to is not part of anything. موسوعة الحديث answers
 * first and answers well — one grading, one attribution — so the model never
 * had a reason to ask further, and never did.
 *
 * `narrator` is lifted onto the chunk because nothing else supplies it. The
 * reference row has asked for «الراوي» since it was written and has never had
 * one to show: موسوعة الحديث returns the matn, the grading and the attribution,
 * and the Companion who narrated it is Dorar's field.
 */
export const withDorarRulings = async (
  chunks: FormattedChunk[],
  apiKey?: string,
): Promise<FormattedChunk[]> => {
  if (!apiKey) return chunks;

  const isHadith = (chunk: FormattedChunk) =>
    chunk.metadata?.source === "hadeethenc" && Boolean(chunk.metadata.grade);

  const targets = chunks.filter(isHadith).slice(0, MAX_ENRICHED);
  if (targets.length === 0) return chunks;

  const found = new Map<string, DorarRuling[]>();
  /*
   * The Dorar pages themselves, kept rather than dropped.
   *
   * They were being read and then thrown away: the rulings went onto the hadith
   * as metadata and the pages they came from vanished, so المصادر listed three
   * entries from موسوعة الأحاديث النبوية and no الدرر السنية at all. A source
   * the system actually read, and whose gradings the answer leans on, has to be
   * in the list a reader checks it against — that is the whole of criterion 4,
   * and it is the reason Dorar is in the allow-list to begin with.
   *
   * Keyed by document id, because one page can answer for more than one hadith
   * in the same read and must still be a single source.
   */
  const pages = new Map<string, FormattedChunk>();

  await Promise.all(
    targets.map(async (chunk) => {
      const { rulings, chunks: read } = await fetchDorarHadith(
        chunk.text,
        apiKey,
      );
      if (rulings.length > 0) found.set(chunk.id, rulings);
      // only the pages that yielded a ruling: one that produced nothing citable
      // is a search that failed, not a source
      if (rulings.length > 0) {
        for (const page of read) if (!pages.has(page.id)) pages.set(page.id, page);
      }
    }),
  );

  const enriched = chunks.map((chunk) => {
    const rulings = found.get(chunk.id);
    if (!rulings) return chunk;

    const narrator = rulings.find((ruling) => ruling.narrator)?.narrator;
    return {
      ...chunk,
      metadata: {
        ...chunk.metadata,
        rulings,
        ...(narrator && !chunk.metadata?.narrator && { narrator }),
      },
    };
  });

  return [...enriched, ...pages.values()];
};
