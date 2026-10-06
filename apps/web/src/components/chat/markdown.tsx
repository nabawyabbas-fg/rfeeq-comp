import type { MyUIMessage } from "@/types/ai";
import { useMemo } from "react";
import { repairCitationTags } from "@/lib/citation-tags";
import { citesNothing, markUncitedParagraphs } from "@/lib/uncited";
import {
  collectSourceText,
  markScriptureQuotes,
  markUnverifiedQuotes,
} from "@/lib/verify-quotes";

import { MessageResponse } from "@agentset/ui/ai/message";

import { CitationButton } from "./citation-button";
import { useProvidedMessages, useStoreMessages } from "./conversation-messages";
import { ScriptureQuote } from "./scripture-panel";
import { UncitedAnswerBanner, UncitedMarker } from "./uncited-marker";
import { UnverifiedQuote } from "./unverified-quote";

interface MarkdownProps {
  children: string;
  message?: MyUIMessage;
  isLoading?: boolean;
}

export const Markdown = (props: MarkdownProps) => {
  // see CitationButton: sibling components rather than a conditional hook
  const provided = useProvidedMessages();
  return provided ? (
    <MarkdownWith {...props} messages={provided} />
  ) : (
    <MarkdownFromStore {...props} />
  );
};

const MarkdownFromStore = (props: MarkdownProps) => (
  <MarkdownWith {...props} messages={useStoreMessages()} />
);

const MarkdownWith = ({
  children,
  isLoading,
  message,
  messages,
}: MarkdownProps & { messages: MyUIMessage[] }) => {
  // Quotations are checked against every passage retrieved in this conversation,
  // not just the ones cited beside them — a verse may legitimately be quoted
  // from a chunk the model cited elsewhere in the answer.
  const text = useMemo(() => {
    // Skip while streaming: a quote arriving character by character is
    // incomplete, and would be flagged for no reason on its way in.
    if (isLoading || message?.role !== "assistant") return children;
    // repaired first: the uncited check below reads citation tags, and a
    // malformed one would make a sourced paragraph look unsourced
    const repaired = repairCitationTags(children);
    // scripture first: it wraps every quotation, and marking the unverified
    // ones afterwards nests the two marks instead of splitting a quote in half
    const withQuotes = markUnverifiedQuotes(
      markScriptureQuotes(repaired),
      collectSourceText(messages),
    );
    return markUncitedParagraphs(withQuotes);
  }, [children, isLoading, message?.role, messages]);

  // an answer that attributes nothing gets one clear statement, not a mark on
  // every paragraph
  const unattributed =
    !isLoading &&
    message?.role === "assistant" &&
    citesNothing(repairCitationTags(children));

  return (
    // dir="auto" resolves direction from the first strong character, so an
    // Arabic answer renders RTL and an English one LTR without a global
    // setting — necessary when the corpus and the user's language differ.
    <div dir="auto" className="flex flex-col gap-3">
      {unattributed && <UncitedAnswerBanner />}
      <MessageResponse
        allowedTags={{
          // <citation ids="..." /> tags emitted by the model
          citation: ["ids"],
          // injected above by markUnverifiedQuotes / markUncitedParagraphs.
          // Both must be declared here or the sanitiser drops them and the
          // flagging silently does nothing.
          unverified: [],
          uncited: [],
          // injected by markScriptureQuotes; makes each quotation openable
          scripture: ["kind"],
        }}
        // both surfaces stream word-by-word (smoothStream) like qaf, so no
        // client-side token animation is needed
        animated={false}
        isAnimating={isLoading && message?.role === "assistant"}
        components={{
          citation: ({ node: _, ...props }) => <CitationButton {...props} />,
          unverified: ({ node: _, ...props }) => <UnverifiedQuote {...props} />,
          scripture: ({ node: _, ...props }) => <ScriptureQuote {...props} />,
          uncited: () => <UncitedMarker />,
        }}
      >
        {/* `text`, not `children`: the verified-quote and uncited marks are
            injected above, and rendering the raw string threw them away. */}
        {text}
      </MessageResponse>
    </div>
  );
};
