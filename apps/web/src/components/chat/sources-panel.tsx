"use client";

import type { FormattedChunk } from "@/lib/agentic-search/format-chunk";
import type { MyUIMessage } from "@/types/ai";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { HostingContext } from "@/contexts/hosting-context";
import { retrievalChunks } from "@/lib/tool-output";
import { ChevronLeftIcon, ChevronRightIcon, FileTextIcon } from "lucide-react";

import { MessageResponse } from "@agentset/ui/ai/message";
import { Button } from "@agentset/ui/button";
import { cn } from "@agentset/ui/cn";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@agentset/ui/sheet";

import { resolveCorpus, resolveSourceTitle } from "./citation-modal";
import { CorpusTag } from "./corpus-tag";

interface SourcesPanelApi {
  /** Open the panel on one document, optionally highlighting specific chunks. */
  openSource: (documentId: string, focusChunkIds?: string[]) => void;
  /** Open the panel on the full list of documents. */
  openList: () => void;
  sourceCount: number;
}

/**
 * Lets the inline citation pills drive the same panel the "Searched N sources"
 * button opens, instead of each citation spawning its own dialog. Null outside
 * a provider, so other surfaces keep their existing behaviour.
 */
const SourcesPanelContext = createContext<SourcesPanelApi | null>(null);

export const useSourcesPanel = () => use(SourcesPanelContext);

/** One document the answer drew on, with every chunk retrieved from it. */
interface Source {
  documentId: string;
  title: string;
  subtitle?: string;
  /** Which collection the document belongs to; see resolveCorpus. */
  corpus: string;
  chunks: FormattedChunk[];
}

// Common keys for a secondary line under the title. Falls back to nothing when
// the knowledge base has no such field, so this stays generic.
const SUBTITLE_KEYS = ["authorName", "author", "creator"];

const readSubtitle = (chunk: FormattedChunk) => {
  for (const key of SUBTITLE_KEYS) {
    const value = chunk.metadata?.[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
};

/**
 * Collects the chunks a single assistant turn retrieved and groups them by
 * document, so the reader sees "which books did this answer come from" rather
 * than a flat list of fragments.
 */
export const useMessageSources = (message: MyUIMessage): Source[] => {
  const hosting = use(HostingContext);
  const labelPath = hosting?.citationMetadataPath;

  return useMemo(() => {
    const byDocument = new Map<string, Source>();

    for (const part of message.parts) {
      // any retrieval tool, not just the two built-in ones: the Rfeeq
      // allow-listed sources return chunks through tools of their own
      for (const chunk of retrievalChunks(part)) {
        const existing = byDocument.get(chunk.documentId);
        if (existing) {
          // the same chunk can come back from several searches
          if (!existing.chunks.some((c) => c.id === chunk.id)) {
            existing.chunks.push(chunk);
          }
          continue;
        }

        const title = resolveSourceTitle(chunk, labelPath) ?? chunk.documentId;

        byDocument.set(chunk.documentId, {
          documentId: chunk.documentId,
          title,
          subtitle: readSubtitle(chunk),
          corpus: resolveCorpus(chunk),
          chunks: [chunk],
        });
      }
    }

    // reading order within a document
    for (const source of byDocument.values()) {
      source.chunks.sort(
        (a, b) => (a.sequence_number ?? 0) - (b.sequence_number ?? 0),
      );
    }

    return [...byDocument.values()];
  }, [message.parts, labelPath]);
};

const ChunkBody = ({
  chunk,
  highlighted,
}: {
  chunk: FormattedChunk;
  highlighted?: boolean;
}) => {
  const ref = useRef<HTMLDivElement>(null);

  // bring the cited passage into view when the panel is opened from a pill
  useEffect(() => {
    if (highlighted) {
      ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [highlighted]);

  const volume = chunk.metadata?.volume;
  const page = chunk.metadata?.printedPage ?? chunk.page_number;
  const headings = chunk.metadata?.headings;
  const url = chunk.metadata?.sourceUrl;

  return (
    <div
      ref={ref}
      className={cn(
        "border-border scroll-mt-4 border-t py-4 first:border-t-0 first:pt-0",
        highlighted && "bg-accent/60 -mx-2 rounded-md px-2",
      )}
    >
      <div className="text-muted-foreground mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {volume ? <span>ج{String(volume)}</span> : null}
        {page ? <span>ص{String(page)}</span> : null}
        {typeof chunk.score === "number" && (
          <span>· {chunk.score.toFixed(3)}</span>
        )}
      </div>

      {Array.isArray(headings) && headings.length > 0 && (
        <p dir="auto" className="text-muted-foreground mb-2 text-xs">
          {headings.join(" › ")}
        </p>
      )}

      <div dir="auto" className="text-sm">
        <MessageResponse mode="static">{chunk.text}</MessageResponse>
      </div>

      {typeof url === "string" && url && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground hover:text-foreground mt-2 inline-block text-xs underline"
        >
          View original
        </a>
      )}
    </div>
  );
};

/**
 * Owns the sources sheet for one assistant turn and exposes it through
 * context, so both the "Searched N sources" button and the inline citation
 * pills open the same panel rather than competing surfaces.
 */
export const SourcesProvider = ({
  message,
  children,
}: {
  message: MyUIMessage;
  children: React.ReactNode;
}) => {
  const sources = useMessageSources(message);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [focusIds, setFocusIds] = useState<string[]>([]);

  const openSource = useCallback((documentId: string, focus?: string[]) => {
    setSelected(documentId);
    setFocusIds(focus ?? []);
    setOpen(true);
  }, []);

  const openList = useCallback(() => {
    setSelected(null);
    setFocusIds([]);
    setOpen(true);
  }, []);

  const api = useMemo(
    () => ({ openSource, openList, sourceCount: sources.length }),
    [openSource, openList, sources.length],
  );

  const active = sources.find((s) => s.documentId === selected) ?? null;

  return (
    <SourcesPanelContext value={api}>
      {children}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full gap-0 sm:max-w-lg">
          <SheetHeader className="border-border border-b">
            <SheetTitle className="flex items-center gap-2">
              {active && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="-ml-2 size-7"
                  onClick={() => {
                    setSelected(null);
                    setFocusIds([]);
                  }}
                  aria-label="Back to all sources"
                >
                  <ChevronLeftIcon className="size-4" />
                </Button>
              )}
              <span dir="auto" className="truncate">
                {active ? active.title : `Sources (${sources.length})`}
              </span>
            </SheetTitle>
          </SheetHeader>

          <div className="overflow-y-auto px-4 py-2">
            {active ? (
              <>
                <CorpusTag
                  corpus={active.corpus}
                  className="mb-1 inline-block"
                />
                {active.subtitle && (
                  <p dir="auto" className="text-muted-foreground mb-3 text-sm">
                    {active.subtitle}
                  </p>
                )}
                {active.chunks.map((chunk) => (
                  <ChunkBody
                    key={chunk.id}
                    chunk={chunk}
                    highlighted={focusIds.includes(chunk.id)}
                  />
                ))}
              </>
            ) : (
              sources.map((source) => (
                <button
                  key={source.documentId}
                  type="button"
                  onClick={() => openSource(source.documentId)}
                  className={cn(
                    "hover:bg-accent border-border flex w-full items-start gap-3",
                    "border-b px-1 py-3 text-left transition-colors last:border-b-0",
                  )}
                >
                  <FileTextIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <CorpusTag corpus={source.corpus} />
                      <span dir="auto" className="block text-sm font-medium">
                        {source.title}
                      </span>
                    </span>
                    {source.subtitle && (
                      <span
                        dir="auto"
                        className="text-muted-foreground block text-xs"
                      >
                        {source.subtitle}
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {source.chunks.length}
                  </span>
                </button>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </SourcesPanelContext>
  );
};

/** "Searched N sources" — opens the panel on the full document list. */
export const SourcesTrigger = () => {
  const panel = useSourcesPanel();
  if (!panel || panel.sourceCount === 0) return null;

  return (
    <button
      type="button"
      onClick={panel.openList}
      className="border-border text-muted-foreground hover:text-foreground hover:bg-accent mb-1 inline-flex w-fit items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors"
    >
      Searched {panel.sourceCount} source{panel.sourceCount === 1 ? "" : "s"}
      <ChevronRightIcon className="size-3.5" />
    </button>
  );
};
