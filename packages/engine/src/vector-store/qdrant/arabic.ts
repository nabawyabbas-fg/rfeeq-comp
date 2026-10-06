import { createHash } from "node:crypto";

/**
 * Arabic keyword search only works if index and query agree on orthography.
 * Readers type without diacritics and use alef/ya/ta-marbuta forms
 * interchangeably, so `الطهارة` must match `الطهاره` and `إسلام` must match
 * `اسلام`. We normalise a parallel copy of the text for matching; the stored
 * `text` payload keeps the original for display and citation.
 */
const DIACRITICS = /[ً-ٰٟۖ-ۭ]/g; // tashkīl + Qur'anic marks
const TATWEEL = /ـ/g; // ـــ elongation
const NON_WORD = /[^\p{L}\p{N}]+/gu;

export const normaliseArabic = (input: string): string =>
  input
    .replace(DIACRITICS, "")
    .replace(TATWEEL, "")
    .replace(/[آأإٱ]/g, "ا") // آ أ إ ٱ -> ا
    .replace(/ى/g, "ي") // ى -> ي
    .replace(/ة/g, "ه") // ة -> ه
    .replace(/ؤ/g, "و") // ؤ -> و
    .replace(/ئ/g, "ي") // ئ -> ي
    .toLowerCase();

export const tokenise = (input: string): string[] =>
  normaliseArabic(input)
    .split(NON_WORD)
    .filter((token) => token.length > 1);

/**
 * Maps a term to a stable sparse-vector dimension. Qdrant sparse vectors are
 * indexed by unsigned integers, so we hash rather than maintain a vocabulary —
 * which also means index and query agree without shared state.
 */
const termToIndex = (term: string): number =>
  createHash("sha1").update(term).digest().readUInt32BE(0);

export interface SparseVector {
  indices: number[];
  values: number[];
}

/**
 * Builds a term-frequency sparse vector. The collection declares
 * `modifier: "idf"`, so Qdrant applies inverse document frequency at query time
 * against the live corpus — giving BM25-style scoring without us having to know
 * corpus statistics at write time.
 *
 * Sublinear term frequency (1 + ln tf) keeps a term repeated twenty times on one
 * page from swamping the score.
 */
export const toSparseVector = (text: string): SparseVector => {
  const counts = new Map<number, number>();

  for (const term of tokenise(text)) {
    const index = termToIndex(term);
    counts.set(index, (counts.get(index) ?? 0) + 1);
  }

  const indices: number[] = [];
  const values: number[] = [];
  for (const [index, count] of counts) {
    indices.push(index);
    values.push(1 + Math.log(count));
  }

  return { indices, values };
};

/**
 * Qdrant point ids must be an unsigned integer or a UUID, but chunk ids look
 * like `<documentId>#<chunkId>`. We derive a deterministic UUIDv5-shaped id so
 * upserts stay idempotent, and keep the original id in the payload.
 */
export const toPointId = (id: string): string => {
  const hash = createHash("sha1").update(id).digest("hex").slice(0, 32);
  const bytes = hash.split("");
  bytes[12] = "5"; // version 5
  bytes[16] = "8"; // RFC 4122 variant
  const hex = bytes.join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
};
