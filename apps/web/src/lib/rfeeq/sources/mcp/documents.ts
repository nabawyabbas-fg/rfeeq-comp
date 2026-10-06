import type { FormattedChunk } from "@/lib/agentic-search/format-chunk";

import { isAllowed } from "../allowlist";
import { callMcpTool } from "./client";

/**
 * Turning an approved publisher's MCP document into a citable chunk.
 *
 * The servers return documents already separated into segments by what may be
 * done with each one — `exact` is published text to be reproduced verbatim,
 * `attribution` is a name or a grading to be copied without rewording, and
 * `commentary` is the publisher's own prose, which may be summarised if it is
 * attributed. That distinction is the brief's تمييز كلام المفسر عن النص, handed
 * to us as structure rather than left to a prompt, so this module keeps it:
 * only `exact` text reaches a chunk's `text`, and commentary travels in
 * metadata where the answer can use it but cannot quote it as scripture.
 *
 * Two checks happen here and nowhere else.
 */

/** A document as the approved servers return it. */
interface McpDocument {
  id: string;
  title: string;
  text: string;
  url: string;
  segments?: { kind?: string; label?: string; text?: string }[];
  metadata?: Record<string, unknown>;
}

const str = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

/**
 * The publisher key a citation is labelled by.
 *
 * Keyed to the body that published the *text*, not to the host that serves the
 * page and not to the protocol that fetched it. A Qurʾānic verse read over MCP
 * has its page on `islamenc.com` and its text from موسوعة القرآن الكريم; the
 * label says the latter, because that is what a reader weighs the citation by.
 *
 * `resolveCorpus` in the citation modal maps these to Arabic names. A key with
 * no entry there would be title-cased and shown raw, which is how every web
 * result once came out labelled "Approved-web" — so a new key here needs a
 * label there.
 */
const PUBLISHERS: Record<string, string> = {
  QuranEnc: "quranenc",
  HadeethEnc: "hadeethenc",
  IslamHouse: "islamcontent",
};

/**
 * The document id an encyclopedia *search* result maps to.
 *
 * A search returns `hadith:65004:ar`; the chunk that `read_sources` then builds
 * is `hadeethenc-65004#0`. Both ids are in the model's context, and it reaches
 * for the first one it saw — which is the search id. That is not a failure
 * worth instructing away: the renderer knows the mapping, so it applies it.
 *
 * Found by running the brief's own case 6, where a `ref` of `hadith:65004:ar`
 * resolved to nothing and silently dropped the matn, the source and the grading
 * from the answer, leaving a correct verdict with none of its evidence.
 */
const CORPUS_PUBLISHER: Record<string, string> = {
  hadith: "hadeethenc",
  quran: "quranenc",
  library: "islamcontent",
};

export const documentIdForSearchId = (id: string) => {
  const [corpus] = id.split(":");
  const publisher = corpus ? CORPUS_PUBLISHER[corpus] : undefined;
  return publisher ? documentIdFor(id, publisher) : null;
};

const documentIdFor = (id: string, publisher: string) => {
  // ids arrive as "hadith:4560:ar", "quran:16:125:ar", "library:116019:ar".
  // The language suffix is dropped so the same hadith read in two languages is
  // one source card rather than two, and the publisher prefix is used so a
  // numeric id cannot collide across corpora.
  const parts = id.split(":");
  const body = parts.slice(1, -1).join("-") || parts.slice(1).join("-") || id;
  return `${publisher}-${body}`;
};

/**
 * Builds a citable chunk, or refuses to.
 *
 * Returns null in exactly two cases, both of which are the allow-list and the
 * brief enforced in code rather than in a prompt:
 *
 * **The publisher host is not approved.** The gateway we connect to is on a
 * closed list of its own, but the document it hands back names its own source
 * page, and that page is the provenance a reader can act on. A document
 * published somewhere off the allow-list is dropped — the gateway being
 * approved does not make everything reachable through it approved.
 *
 * **A hadith arrives without its grading or its attribution.** The brief's
 * strictest sentence is «لا ينسب حديث دون مصدر وحكم معتمد في البيانات», and
 * these servers carry both as structured fields, so the rule is checkable. A
 * report whose authentication the data does not carry is not evidence this
 * system may cite, and dropping it here means no amount of prompt drift can
 * surface it. The answer then has nothing to quote, which is the correct
 * outcome: criterion 4 ranks abstention above an unsourced claim.
 */
export const toChunk = (document: McpDocument): FormattedChunk | null => {
  const url = str(document.url);
  if (url && !isAllowed(url)) return null;

  const metadata = document.metadata ?? {};
  const rawPublisher = str(metadata.source) ?? "";
  const publisher = PUBLISHERS[rawPublisher] ?? rawPublisher.toLowerCase();

  const grade = str(metadata.grade);
  const attribution = str(metadata.attribution);
  const isHadith = document.id.startsWith("hadith:");
  if (isHadith && (!grade || !attribution)) return null;

  const segments = document.segments ?? [];
  const pick = (kind: string) =>
    segments
      .filter((segment) => segment.kind === kind)
      .map((segment) => str(segment.text))
      .filter((text): text is string => Boolean(text));

  const exact = pick("exact");
  const commentary = pick("commentary");

  /*
   * `exact` is the published text. When the server sends more than one — a
   * verse and its approved translation — the first is the original and the rest
   * are the renderings, so the original alone becomes the chunk's text and the
   * rest travel as `translation`. Quoting a translation as though it were the
   * verse is the specific failure this split prevents.
   */
  const [original, ...renderings] = exact;
  const text = original ?? str(document.text) ?? "";
  if (!text) return null;

  const documentId = documentIdFor(document.id, publisher || "approved");

  return {
    id: `${documentId}#0`,
    documentId,
    text,
    metadata: {
      source: publisher || undefined,
      title: str(document.title),
      ...(grade && { grade }),
      ...(attribution && { attribution }),
      ...(renderings.length > 0 && { translation: renderings.join("\n\n") }),
      /*
       * The publisher's own explanation and benefits. Kept out of `text` so the
       * model cannot quote a modern gloss as the Prophet's words, and kept in
       * metadata so it can still be summarised with attribution — which is what
       * the servers mark this material as permitting.
       */
      ...(commentary.length > 0 && { explanation: commentary.join("\n\n") }),
      ...(str(metadata.translation_key) && {
        translationEdition: str(metadata.translation_key),
      }),
      ...(Array.isArray(metadata.categories) &&
        metadata.categories.length > 0 && {
          headings: metadata.categories.filter(
            (value): value is string => typeof value === "string",
          ),
        }),
      ...(metadata.surah !== undefined && { sura: metadata.surah }),
      ...(metadata.aya !== undefined && { aya: metadata.aya }),
      ...(url && { sourceUrl: url }),
    },
  };
};

/**
 * Reads one document from the joint encyclopedia server.
 *
 * `fetch` is the only citable path used from that server. Its sibling tools
 * return the same material as prose wrapped in instructions aimed at a chat
 * model — including a block telling the reader's model to print the bare URL in
 * its reply, which would collide with the citation markers this system renders.
 * `fetch` returns the structured document instead, which is both safer to parse
 * and the one shape that carries `grade` and `attribution` as fields.
 */
export const fetchDocument = async (
  id: string,
): Promise<FormattedChunk | null> => {
  const { structuredContent } = await callMcpTool("islamic-content", "fetch", {
    id,
  });
  if (!structuredContent) return null;
  return toChunk(structuredContent as unknown as McpDocument);
};

/** Reads several documents at once, dropping the ones that cannot be cited. */
export const fetchDocuments = async (ids: string[]) => {
  const documents = await Promise.all(
    ids.map((id) =>
      fetchDocument(id).catch(() => null),
    ),
  );
  return documents.filter((chunk): chunk is FormattedChunk => chunk !== null);
};
