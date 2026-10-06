import { AlertTriangleIcon, InfoIcon } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@agentset/ui/tooltip";

/**
 * Appended to a passage that states something without citing a source.
 *
 * Kept quiet on purpose. About one substantive paragraph in eight carries no
 * citation, so a loud marker would shout through every answer; this is a small
 * neutral mark a reader can scan past or hover, not an accusation. The claim may
 * well be sound — what the reader is told is that this particular passage cannot
 * be traced to the retrieved sources.
 */
export const UncitedMarker = () => (
  <Tooltip>
    <TooltipTrigger asChild>
      <span
        className="text-muted-foreground/70 hover:text-foreground mx-0.5 inline-flex cursor-help items-baseline align-baseline transition-colors"
        aria-label="No source cited for this passage"
      >
        <InfoIcon className="size-3.5" aria-hidden="true" />
      </span>
    </TooltipTrigger>
    <TooltipContent className="max-w-xs" dir="auto">
      No source is cited for this passage. It may still be accurate, but it
      cannot be checked against the retrieved texts.
    </TooltipContent>
  </Tooltip>
);

/**
 * Shown above an answer that cites nothing whatsoever.
 *
 * This is the failure the audit found most dangerous: 32 answers in 240 runs
 * retrieved passages and then attributed none of them, reading as authoritative
 * while being entirely unverifiable. A per-paragraph mark on every paragraph
 * would say less than one clear statement at the top.
 */
export const UncitedAnswerBanner = () => (
  <div
    className="border-s-2 border-amber-500/80 bg-amber-500/5 px-3 py-2 text-sm text-amber-700 dark:text-amber-500"
    dir="auto"
    role="note"
  >
    <AlertTriangleIcon
      className="me-1.5 inline size-4 align-text-bottom"
      aria-hidden="true"
    />
    This answer cites no sources. Nothing in it can be traced to the texts that
    were searched — verify before relying on it.
  </div>
);
