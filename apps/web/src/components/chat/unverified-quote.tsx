import { AlertTriangleIcon } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@agentset/ui/tooltip";

/**
 * Marks a quotation that does not appear in any passage retrieved for this
 * conversation.
 *
 * Flagged, not removed: silently dropping a verse would alter the scholarship on
 * the reader's behalf, and a quote can be perfectly correct yet come from a book
 * outside the corpus. What the reader needs to know is that this particular text
 * could not be checked against the sources — so they can verify it themselves
 * before relying on it.
 */
export const UnverifiedQuote = ({
  children,
}: {
  children?: React.ReactNode;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <span className="underline decoration-amber-500/80 decoration-dotted decoration-2 underline-offset-4">
        {children}
        <AlertTriangleIcon
          className="mx-0.5 inline size-3.5 align-baseline text-amber-600 dark:text-amber-500"
          aria-hidden="true"
        />
        <span className="sr-only">
          (not found in the retrieved sources — verify before relying on it)
        </span>
      </span>
    </TooltipTrigger>
    <TooltipContent className="max-w-xs" dir="auto">
      This quotation does not appear in the passages retrieved for this answer.
      It may be accurate but is unverified — check it against a printed source.
    </TooltipContent>
  </Tooltip>
);
