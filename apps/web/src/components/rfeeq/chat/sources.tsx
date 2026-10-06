"use client";

import type { FormattedChunk } from "@/lib/agentic-search/format-chunk";
import type { MyUIMessage } from "@/types/ai";
import {
  createContext,
  useCallback,
  useRef,
  use,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useActiveChat } from "@/components/chat/active-chat.store";
import { useMessageSources } from "@/components/chat/sources-panel";

import { MessageResponse } from "@agentset/ui/ai/message";
import { cn } from "@agentset/ui/cn";

import { Icon } from "../icon";
import { IconButton } from "../ui/button";
import type { HadithDetails } from "./hadith-panel";
import { HadithPanel, hadithDetailsOf } from "./hadith-panel";
import { normaliseArabic } from "@/lib/verify-quotes";

import { kindOf } from "./section";
import { SciencesPanel } from "./sciences-panel";

import { documentIdForSearchId } from "@/lib/rfeeq/sources/mcp/documents";

import { State } from "../ui/feedback";

/** One document the answer drew on, as the panel presents it. */
interface PanelSource {
  documentId: string;
  title: string;
  subtitle?: string;
  corpus: string;
  chunks: FormattedChunk[];
}

/**
 * What the side panel is showing.
 *
 * The specification gives the panel four jobs, not one: the answer's sources,
 * مقدمات السورة when the sūra name is tapped, علوم الآية when the āya is, and
 * علوم الكلمة when a single word is. They share a surface — one panel docked to
 * the chat column — and differ in everything else, so the state is a union and
 * the host switches on it.
 */
export type PanelView =
  | { kind: "sources"; documentId: string | null; focusIds: string[] }
  | { kind: "surah"; surah: number; name: string | null }
  | { kind: "ayah"; surah: number; ayah: number; label: string | null }
  | {
      kind: "word";
      surah: number;
      ayah: number;
      word: number;
      text: string | null;
    }
  /*
   * تفاصيل الحديث carries its data rather than an id to look it up by. The
   * panel host has the answer's sources but not its chunks, and the opener —
   * the matn, which is rendered *from* the chunk — already holds everything
   * the panel shows. Passing it avoids a second resolution that could fail.
   */
  | ({ kind: "hadith" } & HadithDetails);

interface SourcesApi {
  sources: PanelSource[];
  /**
   * This document's position in the answer's source list, 1-based.
   *
   * The whole citation scheme rests on this: an inline marker is a number, and
   * the number has to be the same number the footer and the panel show. One
   * ordering, derived once from the retrieval order, shared by all three.
   */
  numberOf: (documentId: string) => number | null;
  /**
   * One retrieved chunk by its id.
   *
   * The typed sections need this: a `scripture` or `grade` section renders from
   * the chunk the model named in `ref`, rather than from prose the model
   * retyped. That is what makes a verse verbatim by construction and a grading
   * impossible to reword.
   */
  chunkOf: (chunkId: string) => FormattedChunk | null;
  openList: () => void;
  openSource: (documentId: string, focusChunkIds?: string[]) => void;
  /** مقدمات السورة: أسماؤها، نزولها، فضائلها، وإحصاءاتها. */
  openSurah: (surah: number, name?: string | null) => void;
  /** علوم الآية: أسباب النزول، التفاسير، الإعراب، التجويد، القراءات. */
  openAyah: (surah: number, ayah: number, label?: string | null) => void;
  /** تفاصيل الحديث: الراوي، وأحكام المحدّثين عليه بمصادرها وتخريجها. */
  openHadith: (details: HadithDetails) => void;
  /**
   * The hadith a quotation came from, matched by its words.
   *
   * An inline «…» quotation reaches the renderer as text and nothing else —
   * `markScriptureQuotes` is a pass over the answer's prose, so it has no chunk
   * id to carry. Matching on the normalised matn is how this codebase already
   * decides whether a quotation is supported (`isQuoteSupported`), and it is
   * what lets *every* hadith in an answer open its own details rather than one
   * link at the foot standing in for all of them.
   */
  hadithQuoted: (quote: string) => HadithDetails | null;
  /**
   * The āya a quotation came from, matched the same way.
   *
   * A verse quoted inline carries no coordinates either, and علوم الآية is
   * keyed on them. Without this a quoted verse could only open an enlargement —
   * the same words, larger, and nothing a reader did not already have.
   */
  verseQuoted: (quote: string) => { surah: number; ayah: number } | null;
  /** علوم الكلمة: المعنى، الإعراب، التصريف، إحصاءات الجذر. */
  openWord: (
    surah: number,
    ayah: number,
    word: number,
    text?: string | null,
  ) => void;
  /** The document the panel is showing *for this message*, if any. */
  activeDocumentId: string | null;
  isOpen: boolean;
}

const SourcesContext = createContext<SourcesApi | null>(null);

export const useRfeeqSources = () => use(SourcesContext);

/* ---------- the docked panel ---------- */

interface PanelState {
  /** Which answer the panel belongs to; only one is open at a time. */
  ownerId: string;
  sources: PanelSource[];
  view: PanelView;
}

interface HostApi {
  open: (state: PanelState) => void;
  state: PanelState | null;
}

const HostContext = createContext<HostApi | null>(null);

/**
 * Hosts the source panel for the whole conversation.
 *
 * One panel, docked to the chat column, not one per answer. It was per-answer
 * at first, which positioned it against a single message's box — so it opened
 * as a card floating over the middle of the thread rather than as a panel
 * flush to the edge, and it could never be full height because the message it
 * was anchored to was not.
 *
 * Mounted around the thread *and* the composer, because the design runs it the
 * full height of the chat area: a reader comparing a ruling against its source
 * should still be able to type.
 */
/**
 * The panel's resting width, and the floor it cannot be dragged below.
 *
 * 400px is the design's default and also its minimum: the panel holds source
 * cards with Arabic titles and a reference line, and narrower than this they
 * start truncating to nothing useful.
 */
const PANEL_WIDTH = 400;

/** The ceiling, as v1.10 sets it: the panel may take 40% of the screen. */
const panelCeiling = () =>
  typeof window === "undefined"
    ? PANEL_WIDTH
    : Math.max(PANEL_WIDTH, window.innerWidth * 0.4);

export function RfeeqSourcesHost({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PanelState | null>(null);

  /*
   * The panel closes when the conversation changes.
   *
   * Its state carries a *snapshot* of one answer's sources, taken when it was
   * opened and keyed to that answer's id. Opening another conversation replaces
   * every message on screen but left the panel exactly as it was — so a hadith
   * answer sat beside «المصادر (3)» listing الطبري، ابن كثير والسعدي from the
   * verse question read before it. The panel was not wrong about its own
   * owner; its owner was simply no longer anywhere on the page.
   *
   * Watching the chat id rather than the messages: the messages change on every
   * streamed token, and re-rendering the host — which owns the panel and wraps
   * the whole thread — on each one would be a steep price for a signal that
   * only matters a few times a session.
   *
   * The `seenChatId !== null` guard is what keeps it from firing at the wrong
   * moment. A conversation that has just been started has no id until its first
   * save lands, so `null → id` is *this* conversation acquiring a record, not a
   * move to another one; closing there would shut the panel under a reader who
   * had opened it moments earlier. A switch (`A → B`) and a new conversation
   * (`A → null`) both close it, which is right in both cases.
   */
  const chatId = useActiveChat((chat) => chat.chatId);
  const [seenChatId, setSeenChatId] = useState(chatId);
  if (seenChatId !== chatId) {
    // adjusted during render rather than in an effect: React re-runs this
    // component before committing, so the panel is never painted once holding
    // the previous conversation's sources
    setSeenChatId(chatId);
    if (seenChatId !== null) setState(null);
  }
  /*
   * Resizable, per v1.10. A reader comparing a long ruling against its sources
   * wants more than a quarter of the screen for them; a reader glancing at one
   * citation wants the answer to keep its width. Neither is the right default
   * for the other, so it is theirs to set.
   */
  const [width, setWidth] = useState(PANEL_WIDTH);
  const frame = useRef<HTMLDivElement>(null);
  const [resizing, setResizing] = useState(false);

  const resizeTo = useCallback((next: number) => {
    setWidth(Math.min(Math.max(next, PANEL_WIDTH), panelCeiling()));
  }, []);

  /*
   * The surface is RTL, so the panel sits against the *left* edge and its inner
   * edge is its right one: the width is the distance from the frame's left to
   * the pointer. A mirrored build would need this one subtraction flipped, as
   * the panel's own transform already does.
   */
  const widthFromPointer = useCallback((clientX: number) => {
    const rect = frame.current?.getBoundingClientRect();
    return rect ? clientX - rect.left : PANEL_WIDTH;
  }, []);
  const api = useMemo(() => ({ open: setState, state }), [state]);

  const view = state?.view ?? null;
  const open = state !== null;

  const title = (() => {
    if (!view) return "";
    switch (view.kind) {
      case "sources":
        return `المصادر (${state?.sources.length ?? 0})`;
      case "surah":
        return view.name ? `سورة ${view.name}` : "مقدمات السورة";
      case "ayah":
        return view.label ?? `علوم الآية ${view.ayah}`;
      case "word":
        return view.text ? `علوم الكلمة: ${view.text}` : "علوم الكلمة";
      case "hadith":
        return "تفاصيل الحديث";
    }
  })();

  return (
    <HostContext value={api}>
      <div
        ref={frame}
        data-resizing={resizing ? "" : undefined}
        className={cn(
          "relative flex min-h-0 flex-1",
          resizing && "cursor-col-resize select-none",
        )}
        style={{ "--rf-spw": `${width}px` } as React.CSSProperties}
      >
        <div
          data-panel={open ? "open" : "closed"}
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col",
            "data-[panel=open]:rf:pe-(--rf-spw)",
          )}
        >
          {children}
        </div>

        {open ? (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="تغيير عرض لوحة المصادر"
            aria-valuemin={PANEL_WIDTH}
            aria-valuenow={Math.round(width)}
            tabIndex={0}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              setResizing(true);
            }}
            onPointerMove={(event) => {
              if (!resizing) return;
              resizeTo(widthFromPointer(event.clientX));
            }}
            onPointerUp={(event) => {
              event.currentTarget.releasePointerCapture(event.pointerId);
              setResizing(false);
            }}
            /* the keyboard path: a pointer-only resize is not a control */
            onKeyDown={(event) => {
              const step = event.shiftKey ? 48 : 16;
              if (event.key === "ArrowLeft") resizeTo(width - step);
              else if (event.key === "ArrowRight") resizeTo(width + step);
              else if (event.key === "Home") setWidth(PANEL_WIDTH);
              else return;
              event.preventDefault();
            }}
            onDoubleClick={() => setWidth(PANEL_WIDTH)}
            className={cn(
              "rf:block absolute inset-y-0 z-30 hidden w-2.5 cursor-col-resize touch-none",
              "end-[calc(var(--rf-spw)-5px)]",
              "after:bg-rf-accent after:absolute after:inset-y-0 after:start-1 after:w-0.5",
              "after:opacity-0 after:transition-opacity hover:after:opacity-100",
              "focus-visible:after:opacity-100 focus-visible:outline-none",
              resizing && "after:opacity-100",
            )}
          />
        ) : null}

        <aside
          data-state={open ? "open" : "closed"}
          aria-hidden={!open}
          aria-label="لوحة المصادر"
          className={cn(
            /*
             * Anchored to the inline end — the left edge in this RTL app — and
             * slid out by a physical transform, which is why the sign is
             * negative. The surface is RTL-only; a mirrored build would need
             * this one value flipped.
             */
            "rf:w-(--rf-spw) absolute inset-y-0 end-0 z-20 flex w-full flex-col",
            "border-rf-line bg-rf-surface shadow-rf-3 border-s",
            !resizing &&
              "transition-transform duration-[250ms] ease-[cubic-bezier(.2,.8,.2,1)]",
            open ? "translate-x-0" : "invisible -translate-x-[105%]",
          )}
        >
          <div
            className="border-rf-line flex min-h-15 shrink-0 items-center gap-1 border-b p-2 ps-4"
          >
            <h3 className="font-rf-ui text-rf-h3 text-rf-text flex-1 truncate font-semibold">
              {title}
            </h3>

            <IconButton
              aria-label="طيّ لوحة المصادر"
              onClick={() => setState(null)}
            >
              <Icon name="x" />
            </IconButton>
          </div>

          {/* `overflow-x-hidden`: nothing in this pane is reached by scrolling
              it sideways, and `overflow-y: auto` alone computes `overflow-x`
              to `auto` too, so one wide child turns the pane into a horizontal
              scroller */}
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4">
            {view?.kind === "hadith" ? (
              <HadithPanel details={view} />
            ) : view && view.kind !== "sources" ? (
              <SciencesPanel
                view={view}
                onAyah={(surah, ayah) =>
                  setState((current) =>
                    current
                      ? {
                          ...current,
                          view: { kind: "ayah", surah, ayah, label: null },
                        }
                      : current,
                  )
                }
              />
            ) : (state?.sources.length ?? 0) === 0 ? (
              <State
                icon="search"
                title="لا مصادر لهذه الإجابة"
                description="لم تُسترجع مقاطع من المصادر في هذه الإجابة."
              />
            ) : (
              /*
               * `grid-cols-1`, which is `minmax(0, 1fr)`. A bare `grid` gets a
               * single *auto* track sized to its items' max-content — here the
               * longest source title in full, «التفسير الميسر، مجمع الملك فهد
               * لطباعة المصحف الشريف» — so every card grew past the panel and
               * the whole pane scrolled sideways. The titles already truncate;
               * they never got the chance, because the track was as wide as
               * they were. The same bug once widened the history rail.
               */
              <div className="grid grid-cols-1 gap-2">
                {state?.sources.map((source, index) => (
                  <SourceCard
                    key={source.documentId}
                    source={source}
                    number={index + 1}
                    /* a citation that named this source opens its card */
                    open={
                      view?.kind === "sources" &&
                      view.documentId === source.documentId
                    }
                    focusIds={
                      view?.kind === "sources" ? view.focusIds : []
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </HostContext>
  );
}

/**
 * One answer's sources: their numbering, and the handles that open them.
 *
 * Computes the list and owns the numbering — which is per answer — but renders
 * nothing. The panel itself lives once, in the host above.
 */
export function RfeeqSourcesProvider({
  message,
  children,
}: {
  message: MyUIMessage;
  children: React.ReactNode;
}) {
  const host = use(HostContext);
  const retrieved = useMessageSources(message) as PanelSource[];

  /*
   * The āya is not one of the answer's sources.
   *
   * It is the thing being asked about, and the answer already shows it in full
   * — in the muṣḥaf hand, with its sūra and number, and with مقدمات السورة and
   * علوم الآية a tap away. Listing «Qur'an 9:15 · موسوعة القرآن» beneath that as
   * though it were a reference the reader should go and check adds a row that
   * says nothing the verse has not already said, and pushes the commentaries —
   * which *are* sources, and which the reader may well want to weigh — down
   * the list.
   *
   * Filtered out of the *list* only. `chunks` below is still built from
   * everything retrieved, because the typed sections render the verse from its
   * chunk: dropping it from the index would leave the verse section with
   * nothing to render and fall back to the model's own prose, which is the one
   * thing scripture must never be. A citation pointing at it simply renders
   * nothing — `citation.tsx` returns null when a document has no number.
   */
  const sources = useMemo(
    () =>
      retrieved.filter(
        (source) => !source.chunks.every((chunk) => kindOf(chunk) === "quran"),
      ),
    [retrieved],
  );

  const numbers = useMemo(() => {
    const map = new Map<string, number>();
    sources.forEach((source, index) => map.set(source.documentId, index + 1));
    return map;
  }, [sources]);

  /*
   * Indexed by every name a chunk answers to.
   *
   * A structural section's `ref` comes from the model, which has two id
   * namespaces in front of it: the chunk ids that `read_sources` returned
   * (`hadeethenc-65004#0`) and the search ids that found them
   * (`hadith:65004:ar`). It reaches for either. Indexing the document id and
   * the search id alongside the chunk id costs nothing and turns a dropped
   * section back into a rendered one — the alternative was a sterner
   * instruction, which is a preference rather than a guarantee.
   */
  const chunks = useMemo(() => {
    const map = new Map<string, FormattedChunk>();
    // `retrieved`, not `sources`: the verse is kept out of the list but must
    // stay resolvable, since the scripture section renders from its chunk
    for (const source of retrieved) {
      for (const chunk of source.chunks) {
        map.set(chunk.id, chunk);
        if (!map.has(chunk.documentId)) map.set(chunk.documentId, chunk);
      }
    }
    return map;
  }, [retrieved]);

  /*
   * Every retrieved hadith, by its normalised matn.
   *
   * Built from `retrieved` rather than the listed sources: a hadith is a hadith
   * whether or not it is shown in المصادر, and the verse filter above must not
   * reach this.
   */
  const hadithByMatn = useMemo(() => {
    const out: { matn: string; chunk: FormattedChunk }[] = [];
    for (const source of retrieved) {
      for (const chunk of source.chunks) {
        if (!hadithDetailsOf(chunk)) continue;
        const matn = normaliseArabic(chunk.text);
        if (matn) out.push({ matn, chunk });
      }
    }
    return out;
  }, [retrieved]);

  /** Every retrieved verse, by its normalised text. */
  const verseByText = useMemo(() => {
    const out: { text: string; surah: number; ayah: number }[] = [];
    for (const source of retrieved) {
      for (const chunk of source.chunks) {
        if (kindOf(chunk) !== "quran") continue;
        const surah = Number(chunk.metadata?.sura);
        const ayah = Number(chunk.metadata?.aya);
        const text = normaliseArabic(chunk.text);
        if (text && Number.isInteger(surah) && Number.isInteger(ayah)) {
          out.push({ text, surah, ayah });
        }
      }
    }
    return out;
  }, [retrieved]);

  const verseQuoted = useCallback(
    (quote: string) => {
      const needle = normaliseArabic(quote);
      /*
       * Long enough to name one āya. A short span — «بسم الله» — opens half the
       * Qurʾān, and matching on it would send the reader to whichever verse was
       * retrieved first.
       */
      if (needle.length < 12) return null;

      const found =
        verseByText.find((entry) => entry.text.includes(needle)) ??
        verseByText.find((entry) => needle.includes(entry.text));
      return found ? { surah: found.surah, ayah: found.ayah } : null;
    },
    [verseByText],
  );

  const hadithQuoted = useCallback(
    (quote: string) => {
      const needle = normaliseArabic(quote);
      /*
       * Long enough to identify one report. A short phrase — «قال رسول الله» —
       * occurs in every matn retrieved, and matching on it would open whichever
       * hadith happened to be first.
       */
      if (needle.length < 12) return null;

      const found =
        hadithByMatn.find((entry) => entry.matn.includes(needle)) ??
        hadithByMatn.find((entry) => needle.includes(entry.matn));
      return found ? hadithDetailsOf(found.chunk) : null;
    },
    [hadithByMatn],
  );

  const resolveChunk = useCallback(
    (id: string) => {
      const direct = chunks.get(id);
      if (direct) return direct;
      const mapped = documentIdForSearchId(id);
      return (mapped ? chunks.get(mapped) : null) ?? null;
    },
    [chunks],
  );

  const api = useMemo<SourcesApi>(() => {
    const mine = host?.state?.ownerId === message.id ? host.state : null;
    const show = (view: PanelView) =>
      host?.open({ ownerId: message.id, sources, view });

    return {
      sources,
      numberOf: (documentId) => numbers.get(documentId) ?? null,
      chunkOf: resolveChunk,
      openList: () =>
        show({ kind: "sources", documentId: null, focusIds: [] }),
      openSource: (documentId, focusChunkIds) =>
        show({
          kind: "sources",
          documentId,
          focusIds: focusChunkIds ?? [],
        }),
      openSurah: (surah, name) =>
        show({ kind: "surah", surah, name: name ?? null }),
      openAyah: (surah, ayah, label) =>
        show({ kind: "ayah", surah, ayah, label: label ?? null }),
      openWord: (surah, ayah, word, text) =>
        show({ kind: "word", surah, ayah, word, text: text ?? null }),
      openHadith: (details) => show({ kind: "hadith", ...details }),
      hadithQuoted,
      verseQuoted,
      activeDocumentId:
        mine?.view.kind === "sources" ? mine.view.documentId : null,
      isOpen: mine !== null,
    };
  }, [
    host,
    message.id,
    numbers,
    resolveChunk,
    sources,
    hadithQuoted,
    verseQuoted,
  ]);

  return <SourcesContext value={api}>{children}</SourcesContext>;
}

/**
 * The third line of a source card: what identifies this source to a reader.
 *
 * The design gives each kind its own — a verse shows its āya, a hadith its
 * grading and attribution, a page its site.
 */
const sourceReference = (source: PanelSource): string | null => {
  const first = source.chunks[0]?.metadata ?? {};
  const text = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : null;

  const grade = text(first.grade);
  if (grade) {
    const attribution = text(first.attribution);
    return attribution ? `${grade} · ${attribution}` : grade;
  }

  const aya = text(first.aya);
  if (aya) return `الآية ${aya}`;

  // a web page has no reference of its own; the publisher line stands alone
  return null;
};

/** `.src` — a numbered source row. The number is the citation marker. */
/**
 * One source, as a collapsible card that opens in place.
 *
 * v1.10 replaces the list-then-detail navigation with this — «each source is a
 * collapsible card; details open in place». The old arrangement made comparing
 * two sources a round trip through a back button, which is exactly what a
 * reader checking a ruling against its sources spends their time doing.
 *
 * The number is a filled circle when the card is open, so the citation marker
 * in the answer and the card it points at carry the same mark in the same
 * state.
 */
function SourceCard({
  source,
  number,
  open,
  focusIds,
}: {
  source: PanelSource;
  number: number;
  /** Opened because a citation pointed here. */
  open: boolean;
  focusIds: string[];
}) {
  /* a verse's āya, a hadith's grading — never a chunk count, which tells the
     reader about the retrieval rather than about the source */
  const reference = sourceReference(source);

  return (
    <details
      open={open}
      className={cn(
        "border-rf-line rounded-rf-md bg-rf-surface group border-[1.5px]",
        "hover:border-rf-line-strong scroll-mt-2",
      )}
    >
      <summary
        className={cn(
          "flex min-h-14 cursor-pointer list-none items-center gap-3 p-3",
          "marker:content-none [&::-webkit-details-marker]:hidden",
          "focus-visible:outline-rf-focus rounded-rf-md outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "font-rf-ui grid size-7 shrink-0 place-items-center rounded-full text-[13px]/none font-semibold",
            "bg-rf-surface-2 text-rf-text-2 group-open:bg-rf-accent group-open:text-rf-on-accent",
          )}
        >
          {number}
        </span>

        <span className="min-w-0 flex-1">
          {/*
            * The whole name on hover, as the history rail does it.
            *
            * These are the two lines that truncate, and they are the ones worth
            * reading in full: a title like «التفسير الميسر، مجمع الملك فهد
            * لطباعة المصحف الشريف» carries its edition in the part that gets
            * cut, which is exactly what a reader checking a citation is after.
            * Set unconditionally — whether the text is actually clipped is a
            * measurement the browser will not report, and a tooltip repeating a
            * line that happens to fit costs nothing.
            */}
          <span
            title={source.title}
            className="font-rf-ui text-rf-text block truncate text-[15px]/[1.5] font-semibold"
          >
            {source.title}
          </span>
          {source.subtitle ? (
            <span
              title={source.subtitle}
              className="font-rf-ui text-rf-text-2 block truncate text-[13px]/[1.5]"
            >
              {source.subtitle}
            </span>
          ) : null}
          {/*
            * Who published it, and then where in it — two facts, two lines.
            *
            * These were one slot with a fallback, so whichever came first won:
            * a hadith always carries a grading, so «موسوعة الأحاديث النبوية»
            * was never shown for one, while a Dorar page — which has no
            * grading field — did show its publisher. The same card named its
            * publisher or its reference depending on what kind of source it
            * happened to be. A reader checking a citation wants both: the
            * publisher is who stands behind it, the reference is where in them
            * to look.
            */}
          <span className="font-rf-ui text-rf-text-3 block truncate text-xs/[1.6] font-medium">
            {source.corpus}
          </span>
          {reference ? (
            <span
              dir="auto"
              className="font-rf-ui text-rf-text-3 block text-xs/[1.6] font-medium"
            >
              {reference}
            </span>
          ) : null}
        </span>

        <Icon
          name="chev"
          size="sm"
          className="text-rf-text-3 shrink-0 transition-transform group-open:-rotate-90"
        />
      </summary>

      <div className="px-3 pb-3">
        {source.chunks.map((chunk) => (
          <ChunkBody
            key={chunk.id}
            chunk={chunk}
            highlighted={focusIds.includes(chunk.id)}
          />
        ))}
      </div>
    </details>
  );
}

function ChunkBody({
  chunk,
  highlighted,
}: {
  chunk: FormattedChunk;
  highlighted?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // bring the cited passage into view when the panel was opened from a marker
  useEffect(() => {
    if (highlighted) {
      ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [highlighted]);

  /*
   * Chunk metadata is arbitrary JSON, so a value here can be an object as
   * easily as a number. Narrowed before display: `ج[object Object]` is worse
   * than no volume at all, and this is the line a reader checks a citation
   * against.
   */
  const label = (value: unknown) =>
    typeof value === "string" || typeof value === "number"
      ? String(value)
      : null;

  const volume = label(chunk.metadata?.volume);
  const page = label(chunk.metadata?.printedPage ?? chunk.page_number);
  const headings = chunk.metadata?.headings;
  const url = chunk.metadata?.sourceUrl;

  return (
    <div
      ref={ref}
      className={cn(
        "border-rf-line scroll-mt-4 border-t py-4 first:border-t-0 first:pt-0",
        highlighted && "rounded-rf-sm bg-rf-accent-soft -mx-2 px-2",
      )}
    >
      <div className="font-rf-ui text-rf-text-3 mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {volume ? <span>ج{volume}</span> : null}
        {page ? <span>ص{page}</span> : null}
      </div>

      {Array.isArray(headings) && headings.length > 0 ? (
        <p dir="auto" className="font-rf-ui text-rf-text-3 mb-2 text-xs">
          {headings.join(" › ")}
        </p>
      ) : null}

      {/*
        * The retrieved passage in a reading face — the source text, not the
        * generated explanation, which the brief requires be visibly distinct.
        *
        * Three faces, because this card shows **everything** retrieved: verses,
        * narrations, dorar pages, library articles, terminology entries. Only
        * the first two have a hand of their own. A scraped article set in the
        * muṣḥaf's hand is a source presented as scripture — the same mistake
        * that once put a dorar search result inside ﴿ ﴾ at Qurʾānic reading
        * size, and the one this card reintroduced when it had only two
        * branches and sent everything that was not a verse to the matn face.
        */}
      <div
        dir="auto"
        className={
          kindOf(chunk) === "quran"
            ? "font-rf-quran text-rf-text text-[19px]/[2.05] font-normal"
            : kindOf(chunk) === "hadith"
              ? "font-rf-matn rf-matn text-rf-text text-[19px]/[2.05]"
              : "font-rf-ui text-rf-text text-[17px]/[1.9] font-medium"
        }
      >
        <MessageResponse mode="static">{chunk.text}</MessageResponse>
      </div>

      {typeof url === "string" && url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="font-rf-ui text-rf-accent mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium underline underline-offset-4"
        >
          <Icon name="ext" size="sm" mirror />
          عرض المصدر الأصلي
        </a>
      ) : null}
    </div>
  );
}
