"use client";

import { cn } from "@agentset/ui/cn";

import { Chip } from "../ui/tag";
import { ComposerNote } from "./composer";
import { useStarters } from "./use-starters";

/*
 * The trio itself lives in `lib/rfeeq/starters.ts`, which also writes fresh
 * ones. Three, not a grid of twelve: the point is to show that a Qurʾānic, a
 * hadith and a fiqh question are each handled differently, which three examples
 * make and more only dilute. Each carries its corpus's icon — derived from the
 * router, so a chip's mark is always the corpus its question will actually
 * reach.
 */

/**
 * The opening screen: a greeting, the composer, and three ways in.
 *
 * Vertically centred with extra bottom padding rather than true centring — the
 * optical centre of a column whose weight is at the top sits above the
 * geometric one, and the composer is what the eye should land on.
 */
export function ChatHome({
  name,
  welcome,
  composer,
  onPick,
}: {
  /** Null for a guest, who gets the subject rather than a greeting. */
  name: string | null;
  /** A corpus-configured opening line, where one is set. */
  welcome?: string | null;
  composer: React.ReactNode;
  onPick: (question: string) => void;
}) {
  const heading = welcome ?? (name ? `أهلًا، ${name}` : "اسأل عن العلم الشرعي");
  const suggestions = useStarters();

  return (
    <div
      className={cn(
        "grid min-h-0 flex-1 content-center justify-items-center overflow-y-auto",
        "px-5 pt-6 pb-15",
      )}
    >
      <div className="grid w-full max-w-180 gap-5">
        <h1
          className={cn(
            "font-rf-ui text-rf-text text-center font-bold text-balance",
            // the h1 step, a fifth larger: this is the one line on the screen
            "text-[calc(var(--text-rf-h1)*1.2)]/[1.35]",
          )}
        >
          {heading}
        </h1>

        {composer}

        <div
          role="group"
          aria-label="أسئلة مقترحة حسب المجال"
          className="flex flex-wrap justify-center gap-2"
        >
          {suggestions.map((suggestion, index) => (
            <Chip
              key={suggestion.question}
              variant="prompt"
              icon={suggestion.icon}
              onClick={() => onPick(suggestion.question)}
              // entering one after another, as v1.4 specifies: the row reads
              // as an invitation rather than three buttons appearing at once
              style={{ animationDelay: `${120 + index * 90}ms` }}
              className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-backwards w-auto motion-safe:duration-300"
            >
              {suggestion.label}
            </Chip>
          ))}
        </div>

        <ComposerNote />
      </div>
    </div>
  );
}
