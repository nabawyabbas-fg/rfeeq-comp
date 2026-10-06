import type { MyUIMessage } from "@/types/ai";
import { useMemo } from "react";
import { resolveCitationChunks } from "@/lib/citation-resolve";

import {
  ChunksCitationModal,
  resolveCorpus,
  resolveSourceTitle,
} from "./citation-modal";
import { useProvidedMessages, useStoreMessages } from "./conversation-messages";
import { CorpusTag } from "./corpus-tag";
import { useSourcesPanel } from "./sources-panel";

/**
 * Renders the model-emitted <citation ids="chunk-id1,chunk-id2" /> tags. Ids
 * are resolved against the search/expand tool outputs of the whole
 * conversation, since follow-up turns may cite chunks retrieved earlier.
 */
export const CitationButton = ({
  ids,
  children,
}: {
  ids?: string;
  children?: React.ReactNode;
}) => {
  // Hooks cannot be called conditionally, so the two sources of messages live
  // in sibling components rather than in a branch here.
  const provided = useProvidedMessages();
  const pill = provided ? (
    <CitationButtonWith ids={ids} messages={provided} />
  ) : (
    <CitationButtonFromStore ids={ids} />
  );

  /*
   * HTML5 ignores the self-closing slash on an unknown element, so
   * `<citation ids="…" />mid-sentence text` parses that trailing text as the
   * tag's *children* rather than as a sibling. Rendering only the pill dropped
   * it: whole clauses disappeared from answers — "؛ لكون السهر يؤدي إلى:" and
   * the like — while the sentence before and the list after both survived,
   * which is why it read as a corpus problem rather than a rendering one.
   */
  return children ? (
    <>
      {pill}
      {children}
    </>
  ) : (
    pill
  );
};

const CitationButtonFromStore = ({ ids }: { ids?: string }) => (
  <CitationButtonWith ids={ids} messages={useStoreMessages()} />
);

const CitationButtonWith = ({
  ids,
  messages,
}: {
  ids?: string;
  messages: MyUIMessage[];
}) => {
  const panel = useSourcesPanel();

  const chunks = useMemo(
    () => resolveCitationChunks(ids, messages),
    [ids, messages],
  );

  if (chunks.length === 0)
    return (
      <span className="text-muted-foreground text-xs">Unknown citation</span>
    );

  // Inside a message the pill drives the shared sources panel, so a citation
  // and the "Searched N sources" button open the same surface. Elsewhere it
  // falls back to the standalone dialog.
  if (panel) {
    const first = chunks[0]!;
    const label = resolveSourceTitle(first, null) ?? first.documentId;
    const extra = chunks.length > 1 ? `+${chunks.length - 1}` : "";
    // The pill names one document — the first chunk's — and opens that document
    // on click, so the tag has to be that document's corpus. Tagging every
    // corpus in the group read as though the named document belonged to two of
    // them. The rest are reachable through "+N", each tagged in the panel.
    const corpus = resolveCorpus(first);
    const others = [...new Set(chunks.slice(1).map(resolveCorpus))].filter(
      (c) => c !== corpus,
    );

    return (
      <button
        type="button"
        dir="auto"
        onClick={() =>
          panel.openSource(
            first.documentId,
            chunks.map((chunk) => chunk.id),
          )
        }
        className="bg-muted text-muted-foreground hover:bg-accent hover:text-foreground mx-0.5 inline-flex max-w-[18rem] items-center gap-1 truncate rounded px-1.5 py-0.5 align-baseline text-xs transition-colors"
        title={
          others.length
            ? `${corpus} — ${label} (+${chunks.length - 1} from ${others.join(", ")})`
            : `${corpus} — ${label}`
        }
      >
        <CorpusTag corpus={corpus} />
        <span className="truncate">{label}</span>
        {extra && <span className="shrink-0 opacity-70">{extra}</span>}
      </button>
    );
  }

  return <ChunksCitationModal chunks={chunks} />;
};
