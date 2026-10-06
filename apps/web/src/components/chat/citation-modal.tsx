import type { FormattedChunk } from "@/lib/agentic-search/format-chunk";
import { use } from "react";
import { HostingContext } from "@/contexts/hosting-context";

import { SingleLanguageCodeBlock } from "@agentset/ui/ai/code-block";
import { MessageResponse } from "@agentset/ui/ai/message";
import { cn } from "@agentset/ui/cn";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@agentset/ui/dialog";
import { truncate } from "@agentset/utils";

// resolves the hosting-configured citation label (a dot-path into the chunk's
// metadata, e.g. "title" or "foo.bar")
export const resolveMetadataPath = (chunk: FormattedChunk, path: string) => {
  // fields hoisted out of metadata by formatChunk stay addressable
  let value: unknown = {
    filename: chunk.filename,
    page_number: chunk.page_number,
    sequence_number: chunk.sequence_number,
    documentId: chunk.documentId,
    ...chunk.metadata,
  };

  for (const key of path.split(".")) {
    if (value === null || typeof value !== "object") return null;
    value = (value as Record<string, unknown>)[key];
  }

  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  if (typeof value === "boolean") return value ? "True" : "False";

  return null;
};

/**
 * Metadata keys commonly holding a human-readable document title. Tried after
 * the hosting-configured path, which only exists on a hosted deployment — in
 * the playground there is no HostingContext, and without these the label would
 * fall back to an opaque document id.
 */
const TITLE_KEYS = ["bookName", "title", "name", "documentName"];

/**
 * Which collection a chunk came from.
 *
 * The corpora answer different kinds of question — classical books versus
 * contemporary fatwa bodies versus a contemporary-issues encyclopedia — so a
 * reader weighing a citation needs to know which one it is before opening it.
 * Chunks outside turath carry their body in `metadata.source`; their ids are
 * prefixed the same way, which is the fallback when a chunk arrives without
 * metadata.
 *
 * This map only supplies names that are not just the capitalised source key —
 * `islamweb` has to render as "IslamWeb", not "Islamweb". A source without an
 * entry gets its own name rather than someone else's; the earlier version fell
 * through to "Turath" for anything unrecognised, so erej chunks were labelled
 * as classical books until it was added here.
 */
export const CORPUS_LABELS: Record<string, string> = {
  islamweb: "IslamWeb",
  islamqa: "IslamQA",
  erej: "Erej",

  /*
   * The live approved platforms, named the way they name themselves.
   *
   * A citation's label is what a reader weighs it by, so it has to be the
   * publisher — «الدرر السنية» — and not the mechanism that fetched it. Without
   * these the fallback title-cases the raw key, and every web result was
   * labelled "Approved-web", which tells a reader nothing about who said it.
   */
  quranenc: "موسوعة القرآن",
  quranpedia: "موسوعة القرآن",
  "quranpedia.net": "موسوعة القرآن",
  hadeethenc: "موسوعة الحديث",
  terminologyenc: "موسوعة المصطلحات",
  "dorar.net": "الدرر السنية",
  "islamqa.info": "الإسلام سؤال وجواب",
  "binbaz.org.sa": "موقع ابن باز",
  "binothaimeen.net": "موقع ابن عثيمين",
  "old.binothaimeen.net": "موقع ابن عثيمين",
  "shamela.ws": "المكتبة الشاملة",
  "bohoth.awqaf.gov.kw": "الموسوعة الفقهية الكويتية",
  "dawa.center": "المستودع الدعوي الرقمي",
  "islamhouse.com": "دار الإسلام",
  "byenah.com": "بيان الإسلام",
  "islamic-content.com": "موسوعة الجمهرة",
  "tafsir.net": "مركز تفسير",

  /*
   * The publishers read over their own content servers. Keyed by the body that
   * published the text, not by the host that serves the page and not by the
   * protocol that fetched it: a verse's page lives on `islamenc.com` and its
   * text is موسوعة القرآن الكريم's, and the label says the latter because that
   * is what a reader weighs the citation by.
   */
  islamcontent: "موسوعة المحتوى الإسلامي",
  "islamenc.com": "موسوعة المحتوى الإسلامي",
  "islamcontent.com": "موسوعة المحتوى الإسلامي",
  "tafsir-center": "مركز تفسير",
  "modoee.com": "موسوعة التفسير الموضوعي",
};

const titleCase = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

export const resolveCorpus = (chunk: FormattedChunk): string => {
  const source = chunk.metadata?.source;
  if (typeof source === "string" && source.trim()) {
    return CORPUS_LABELS[source] ?? titleCase(source);
  }
  // ids look like "fatwa-islamweb-810294-en#0" or "fatwa-erej-660-ar#0"
  const [, prefix] = chunk.id.split("-");
  if (chunk.id.startsWith("fatwa-") && prefix) {
    return CORPUS_LABELS[prefix] ?? titleCase(prefix);
  }
  // turath ids look like "turath-10517#10517:858" and carry no source key
  if (chunk.id.startsWith("turath-")) return "Turath";
  return "Source";
};

/** Best available display title for the document a chunk came from. */
export const resolveSourceTitle = (
  chunk: FormattedChunk,
  labelPath?: string | null,
): string | null => {
  if (labelPath) {
    const label = resolveMetadataPath(chunk, labelPath);
    if (label) return label;
  }

  for (const key of TITLE_KEYS) {
    const value = chunk.metadata?.[key];
    if (typeof value === "string" && value.trim()) return value;
  }

  return chunk.filename ?? null;
};

const useCitationLabel = (chunk?: FormattedChunk) => {
  // null outside a hosted deployment
  const hosting = use(HostingContext);

  if (!chunk) return "Source";

  return resolveSourceTitle(chunk, hosting?.citationMetadataPath) ?? "Source";
};

const stringifyMetadata = (metadata?: Record<string, unknown>) => {
  if (!metadata || Object.keys(metadata).length === 0) return null;
  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return "Failed to parse metadata!";
  }
};

/**
 * Pill-style citation: one citation can reference multiple chunks, resolved
 * by id from the conversation's tool outputs.
 */
export function ChunksCitationModal({ chunks }: { chunks: FormattedChunk[] }) {
  const label = useCitationLabel(chunks[0]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground mx-0.5 cursor-pointer rounded-full px-2 py-0.5 text-sm font-medium hover:no-underline"
          type="button"
        >
          {truncate(label, 25, "...")}
          {chunks.length > 1 && (
            <span className="ms-1">+{chunks.length - 1}</span>
          )}
        </button>
      </DialogTrigger>

      <DialogContent
        className="sm:max-w-2xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault(); // prevents Radix from auto-focusing the first focusable
        }}
        scrollableOverlay
      >
        <DialogHeader>
          <DialogTitle>{chunks.length > 1 ? "Sources" : label}</DialogTitle>
        </DialogHeader>

        {chunks.map((chunk, index) => {
          const stringifiedMetadata = stringifyMetadata(chunk.metadata);

          return (
            <div
              key={chunk.id}
              className={cn(index > 0 && "border-border mt-6 border-t pt-6")}
            >
              {chunks.length > 1 && chunk.filename && (
                <h3 className="mb-2 text-xs font-medium">{chunk.filename}</h3>
              )}

              <div dir="auto" className="mt-2">
                <MessageResponse mode="static">{chunk.text}</MessageResponse>
              </div>

              {stringifiedMetadata && (
                <div className="mt-4">
                  <h3 className="text-xs font-medium">Metadata</h3>
                  <div className="mt-2">
                    <SingleLanguageCodeBlock
                      code={stringifiedMetadata}
                      language="json"
                      header={false}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </DialogContent>
    </Dialog>
  );
}
