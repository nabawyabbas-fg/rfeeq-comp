"use client";

import type { MyUIMessage } from "@/types/ai";
import { useMemo } from "react";
import {
  useProvidedMessages,
  useStoreMessages,
} from "@/components/chat/conversation-messages";
import { resolveCitationChunks } from "@/lib/citation-resolve";

import { cn } from "@agentset/ui/cn";

import { useRfeeqSources } from "./sources";

/**
 * A citation, rendered as the number of the source it points at.
 *
 * The design's central reading affordance, and a deliberate change from naming
 * the book inline. An Arabic answer carries citations mid-sentence, often
 * several to a paragraph; a pill holding a book title breaks the line and
 * forces the eye out of the prose at every attribution. A number does not — and
 * because the same number labels the source in the footer and in the panel, it
 * costs the reader nothing to follow.
 *
 * One marker per distinct *document*, not per chunk id: two passages from one
 * book are one source, and the panel opens on the book with both highlighted.
 */
export function RfeeqCitation({
  ids,
  children,
}: {
  ids?: string;
  children?: React.ReactNode;
}) {
  // Hooks cannot be called conditionally, so the two message sources live in
  // sibling components rather than in a branch.
  const provided = useProvidedMessages();
  const marker = provided ? (
    <CitationWith ids={ids} messages={provided} />
  ) : (
    <CitationFromStore ids={ids} />
  );

  /*
   * HTML5 ignores the self-closing slash on an unknown element, so
   * `<citation ids="…" />mid-sentence text` parses that trailing text as the
   * tag's children rather than as a sibling. Rendering only the marker drops
   * it — whole clauses disappear from the answer. Kept in step with the
   * original pill, where this was found.
   */
  return children ? (
    <>
      {marker}
      {children}
    </>
  ) : (
    marker
  );
}

const CitationFromStore = ({ ids }: { ids?: string }) => (
  <CitationWith ids={ids} messages={useStoreMessages()} />
);

function CitationWith({
  ids,
  messages,
}: {
  ids?: string;
  messages: MyUIMessage[];
}) {
  const panel = useRfeeqSources();
  const chunks = useMemo(
    () => resolveCitationChunks(ids, messages),
    [ids, messages],
  );

  /** Distinct documents, in the order the tag named them. */
  const documents = useMemo(() => {
    const byDocument = new Map<string, string[]>();
    for (const chunk of chunks) {
      const existing = byDocument.get(chunk.documentId);
      if (existing) existing.push(chunk.id);
      else byDocument.set(chunk.documentId, [chunk.id]);
    }
    return [...byDocument.entries()];
  }, [chunks]);

  /*
   * An id that resolves to nothing is reported, not hidden.
   *
   * The brief's الموثوقية والإسناد criterion forbids attributing a statement to
   * a reference it is not in, and a dropped marker would leave the sentence
   * looking unattributed rather than mis-attributed — which is the wrong
   * correction. The reader is told the link is broken.
   */
  if (documents.length === 0) {
    return (
      <span
        title="تعذّر ربط هذه الإحالة بمقطع من المصادر المسترجعة"
        className="font-rf-ui text-rf-trust mx-0.5 align-[0.12em] text-xs font-semibold"
      >
        [؟]
      </span>
    );
  }

  return (
    <>
      {documents.map(([documentId, chunkIds]) => {
        const number = panel?.numberOf(documentId);
        if (!number) return null;

        const active = panel?.activeDocumentId === documentId;

        return (
          <button
            key={documentId}
            type="button"
            aria-label={`المصدر ${number}`}
            aria-pressed={active}
            onClick={() => panel?.openSource(documentId, chunkIds)}
            className={cn(
              "relative inline-flex h-5 min-w-5 cursor-pointer items-center justify-center",
              "rounded-rf-xs border-0 px-[5px] align-[0.12em]",
              /*
               * Quiet by default, filled when active — v1.10. The marker sits
               * inside a sentence dozens of times in a long answer, so the
               * resting state is a bordered chip on the page's own surface
               * rather than a tinted one; what stands out is the citation the
               * reader has opened, not every citation at once.
               *
               * Asymmetric margin, also the design's: 4px before the mark and
               * 2px after, so it reads as attached to the clause it ends
               * rather than floating between two.
               */
              "ms-1 me-0.5 bg-rf-surface font-rf-ui text-rf-text-2 text-xs/none font-semibold",
              "shadow-[inset_0_0_0_1px_var(--rf-line-strong)]",
              "hover:bg-rf-surface-2 hover:text-rf-text",
              active && "bg-rf-accent text-rf-on-accent shadow-none",
              "focus-visible:outline-rf-focus outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2",
              // widens the hit target without widening the mark
              "after:absolute after:-inset-1 after:content-['']",
            )}
          >
            {number}
          </button>
        );
      })}
    </>
  );
}
