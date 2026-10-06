"use client";

import type { ReactNode } from "react";
import {
  createContext,
  isValidElement,
  use,
  useCallback,
  useMemo,
  useState,
} from "react";

import { cn } from "@agentset/ui/cn";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@agentset/ui/sheet";

/** Which delimiter the model used; see corpus-prompts <sacred_text_rendering>. */
export type ScriptureKind = "quran" | "hadith";

export interface ScriptureQuoteRef {
  kind: ScriptureKind;
  /** The quotation exactly as the answer rendered it, delimiters included. */
  text: string;
}

interface ScripturePanelApi {
  open: (quote: ScriptureQuoteRef) => void;
}

/**
 * Opens quoted revelation in its own panel, separate from the sources panel.
 *
 * Deliberately a second surface rather than a tab inside the sources sheet: a
 * citation answers "which book did this come from", a verse or a matn is the
 * text itself, and collapsing the two would make one of the questions harder to
 * ask. Null outside a provider, so a quote simply stays unclickable where no
 * panel is mounted.
 */
const ScripturePanelContext = createContext<ScripturePanelApi | null>(null);

export const useScripturePanel = () => use(ScripturePanelContext);

const KIND_LABEL: Record<ScriptureKind, string> = {
  quran: "Qurʾān",
  hadith: "Hadith",
};

export const ScriptureProvider = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const [quote, setQuote] = useState<ScriptureQuoteRef | null>(null);

  const openQuote = useCallback((next: ScriptureQuoteRef) => {
    setQuote(next);
    setOpen(true);
  }, []);

  const api = useMemo(() => ({ open: openQuote }), [openQuote]);

  return (
    <ScripturePanelContext value={api}>
      {children}

      <Sheet open={open} onOpenChange={setOpen}>
        {/* left: the sources panel owns the right side, and a reader comparing
            a verse against the passage it was drawn from needs both at once */}
        <SheetContent side="left" className="w-full gap-0 sm:max-w-lg">
          <SheetHeader className="border-border border-b">
            <SheetTitle>{quote ? KIND_LABEL[quote.kind] : "Quote"}</SheetTitle>
          </SheetHeader>

          <div className="overflow-y-auto px-6 py-6">
            {quote && (
              <p
                dir="rtl"
                lang="ar"
                className={cn(
                  "text-xl leading-[2.4] text-balance",
                  quote.kind === "quran" && "text-center",
                )}
              >
                {quote.text}
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </ScripturePanelContext>
  );
};

/**
 * Recovers the quotation's plain text from the rendered children.
 *
 * Needed because an unverified quote arrives wrapped in its own marker element,
 * so the text is not always the direct child.
 */
const textOf = (node: ReactNode): string => {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return textOf(node.props.children);
  }
  return "";
};

/** A Qurʾānic or hadith quotation in the answer, openable in the panel. */
export const ScriptureQuote = ({
  kind,
  children,
}: {
  kind?: string;
  children?: ReactNode;
}) => {
  const panel = useScripturePanel();
  const resolved: ScriptureKind = kind === "hadith" ? "hadith" : "quran";

  if (!panel) return <>{children}</>;

  return (
    <button
      type="button"
      dir="auto"
      onClick={() => panel.open({ kind: resolved, text: textOf(children) })}
      className={cn(
        "hover:bg-accent focus-visible:ring-ring cursor-pointer rounded",
        "px-0.5 text-start transition-colors focus-visible:ring-2",
        "focus-visible:outline-none",
      )}
      aria-label={`Open this ${resolved === "quran" ? "verse" : "hadith"} in the quote panel`}
    >
      {children}
    </button>
  );
};
