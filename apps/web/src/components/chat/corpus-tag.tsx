import { cn } from "@agentset/ui/cn";

/**
 * Names the collection a citation came from.
 *
 * The corpora carry different authority — classical books, two contemporary
 * fatwa bodies, and a contemporary-issues encyclopedia — so which one a passage
 * came from is part of reading the citation, not decoration. Each gets its own
 * hue so the distinction survives a glance down a dense Arabic answer; the
 * colours are only ever a second cue, since the label itself is always present.
 */
const STYLES: Record<string, string> = {
  Turath: "bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-200",
  IslamWeb:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  IslamQA: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
  Erej: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};

/**
 * Deliberately neutral rather than Turath's stone. Falling back to a real
 * corpus's colour makes an unknown source look like that corpus at a glance,
 * which is the visual half of the bug that labelled erej as Turath.
 */
const UNKNOWN =
  "bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground";

export const CorpusTag = ({
  corpus,
  className,
}: {
  corpus: string;
  className?: string;
}) => (
  <span
    dir="ltr"
    className={cn(
      "shrink-0 rounded-sm px-1 py-px text-[10px] leading-none font-medium tracking-wide",
      STYLES[corpus] ?? UNKNOWN,
      className,
    )}
  >
    {corpus}
  </span>
);
