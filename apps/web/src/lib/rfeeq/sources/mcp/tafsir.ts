import type { FormattedChunk } from "@/lib/agentic-search/format-chunk";

import { callMcpTool } from "./client";

/**
 * التفسير وعلوم القرآن, from مركز تفسير للدراسات القرآنية.
 *
 * The brief approves this centre for commentary and sets one rule for the
 * domain: «يستخدم لشرح الآية **مع تمييز كلام المفسر عن النص القرآني**» — the
 * commentator's words must be distinguishable from the verse. That is why a
 * tafsīr passage is never the system's Qurʾānic text: the verse comes from
 * موسوعة القرآن through `quran.ts`, and what arrives here is explicitly a named
 * scholar's explanation of it, carrying his name and death year.
 *
 * Every chunk's title is the edition's own attribution line — «تيسير الكريم
 * الرحمن، عبد الرحمن بن ناصر السعدي (ت. 1376هـ)» — because for commentary the
 * citation a reader needs is which commentator said it, and the centre
 * publishes that as a field rather than leaving it to be inferred.
 *
 * Unlike the encyclopedia server, this one publishes no per-āya page, so these
 * chunks carry no link. That is reported honestly rather than papered over with
 * a constructed URL: a rebuilt link that may not resolve is worse than a
 * citation that names the work and the scholar precisely.
 */

const str = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

/**
 * Reads the server's single text block as JSON.
 *
 * These tools return JSON in a text part rather than as structured content.
 * Each payload also carries a `_display` field holding instructions addressed
 * to whichever model reads it. That field is never forwarded: tool output is
 * data, and text that arrives from the network asking to be obeyed is the one
 * thing a retrieval layer must not pass along to the model it feeds. The
 * reproduce-exactly discipline it asks for is already this system's own, stated
 * in its prompt where it belongs.
 */
const payload = <T>(text: string | undefined): T | null => {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

interface TafsirEntry {
  source?: string;
  attribution?: string;
  text?: string;
  text_clean?: string;
  text_display?: string;
  available?: boolean;
  reason?: string;
}

const toChunk = (
  entry: TafsirEntry,
  surah: number,
  ayah: number,
  kind: "tafsir" | "nuzool",
): FormattedChunk | null => {
  const text = str(entry.text_clean ?? entry.text ?? entry.text_display);
  if (!text) return null;

  const slug = str(entry.source) ?? kind;
  const documentId = `tafsir-center-${slug}-${surah}-${ayah}`;

  return {
    id: `${documentId}#0`,
    documentId,
    sequence_number: ayah,
    text,
    metadata: {
      source: "tafsir-center",
      // the scholar and the work — the citation a commentary actually needs
      title: str(entry.attribution) ?? slug,
      attribution: str(entry.attribution),
      edition: slug,
      sura: surah,
      aya: ayah,
      kind,
    },
  };
};

/**
 * Commentary on one āya, from the named editions.
 *
 * `sources` is required rather than defaulted. It used to default to الطبري،
 * ابن كثير، السعدي — the set the specification reserves for **specialists** —
 * which meant every reader got it, including the one who asked a plain
 * question. The editions are a property of the reader now
 * (`lib/rfeeq/expertise.ts`), so a default here could only be the wrong one for
 * somebody; making the caller say which is how the axis stays honest.
 *
 * Fixed per reader rather than left to the model: letting a run pick its
 * editions would make two answers to the same question rest on different
 * commentators, which a reader has no way to account for.
 */
export const fetchTafsir = async (
  surah: number,
  ayah: number,
  sources: string[],
): Promise<FormattedChunk[]> => {
  const { text } = await callMcpTool("tafsir-center", "fetch_tafsir", {
    surah,
    ayah,
    sources,
  });

  const parsed = payload<{ tafsirs?: TafsirEntry[] }>(text);
  if (!parsed?.tafsirs) return [];

  return parsed.tafsirs
    .filter((entry) => entry.available !== false)
    .flatMap((entry) => {
      const chunk = toChunk(entry, surah, ayah, "tafsir");
      return chunk ? [chunk] : [];
    });
};

/**
 * غريب القرآن and هدايات الآية, which the commentary call does not carry.
 *
 * The tafsir template declares both — «غريب القرآن» and «من فوائد الآيات» —
 * and the model was writing neither, correctly: `fetch_tafsir` returns
 * commentary and nothing else, so there was no retrieved material for either
 * section and a section with nothing behind it must not be written. Two of the
 * five sections of a commentary answer were simply never appearing.
 *
 * Both come off `fetch_ayah`: `gharib` is الميسر/السراج في غريب القرآن, keyed
 * phrase by phrase, and `tadabbur` is هدايات القرآن الكريم (مصحف التدبر), which
 * is the «فوائد» material under the centre's own name for it. Soft, like every
 * other fetcher here: a verse the sparse sources do not reach loses its two
 * folded sections, not its answer.
 */
export const fetchAyahExtras = async (
  surah: number,
  ayah: number,
): Promise<FormattedChunk[]> => {
  const { text } = await callMcpTool("tafsir-center", "fetch_ayah", {
    surah,
    ayah,
    include: ["gharib", "tadabbur"],
  });

  const parsed = payload<{ gharib?: string; tadabbur?: string }>(text);
  if (!parsed) return [];

  const of = (
    key: "gharib" | "tadabbur",
    title: string,
    kind: string,
  ): FormattedChunk[] => {
    const body = parsed[key];
    if (typeof body !== "string" || !body.trim()) return [];
    const documentId = `tafsir-center-${key}-${surah}-${ayah}`;
    return [
      {
        id: `${documentId}#0`,
        documentId,
        text: body.trim(),
        metadata: { source: "tafsir-center", title, kind, sura: surah, aya: ayah },
      },
    ];
  };

  return [
    ...of("gharib", `غريب القرآن — ${surah}:${ayah}`, "gharib"),
    ...of("tadabbur", `هدايات الآية — ${surah}:${ayah}`, "fawaid"),
  ];
};

/**
 * The occasion of a verse's revelation, where the sources establish one.
 *
 * Returns `{ established: false }` with the centre's own wording when they do
 * not — «لم يثبت سبب نزول لهذه الآية». That is a finding, not a failure, and
 * one worth reporting: a sabab that the books do not carry is routinely
 * asserted anyway, and being able to say it is not established is the useful
 * answer.
 */
export const fetchNuzoolReason = async (surah: number, ayah: number) => {
  const { text } = await callMcpTool("tafsir-center", "fetch_nuzool_reason", {
    surah,
    ayah,
  });

  const parsed = payload<{ sources?: TafsirEntry[] }>(text);
  const entries = parsed?.sources ?? [];

  const chunks = entries
    .filter((entry) => entry.available !== false)
    .flatMap((entry) => {
      const chunk = toChunk(entry, surah, ayah, "nuzool");
      return chunk ? [chunk] : [];
    });

  if (chunks.length > 0) return { established: true as const, chunks };

  return {
    established: false as const,
    chunks: [] as FormattedChunk[],
    reason:
      entries.find((entry) => str(entry.reason))?.reason ??
      "لم يثبت سبب نزول لهذه الآية في المصادر المعتمدة",
  };
};

interface SourceListing {
  slug?: string;
  name?: string;
  attribution?: string;
  coverage?: string;
  language?: string;
}

/**
 * The commentary editions available, for when the reader asks which.
 *
 * Trimmed to the Arabic editions with full or near-full coverage. A sparse
 * edition is useful to quote when it happens to cover the āya in hand and
 * misleading to offer as a choice, since most of the time it will have nothing.
 */
export const listTafsirSources = async () => {
  const { text } = await callMcpTool("tafsir-center", "list_tafsir_sources", {});
  const parsed = payload<{ items?: (SourceListing & { coverage_kind?: string })[] }>(
    text,
  );

  return (parsed?.items ?? [])
    .filter(
      (item) =>
        item.language === "ar" &&
        (item.coverage_kind === "full" || item.coverage_kind === "near_full"),
    )
    .map((item) => ({
      edition: item.slug,
      name: item.name,
      attribution: item.attribution,
      coverage: item.coverage,
    }));
};
