"use client";

import type { MyUIMessage } from "@/types/ai";
import { useMemo, useState } from "react";
import { ConversationMessagesProvider } from "@/components/chat/conversation-messages";
import { Markdown } from "@/components/chat/markdown";
import { MessageMetrics } from "@/components/chat/message-metrics";
import { ScriptureProvider } from "@/components/chat/scripture-panel";
import { SourcesProvider } from "@/components/chat/sources-panel";
import { copyText } from "@/lib/copy-text";
import { chunksOfToolOutput } from "@/lib/tool-output";
import { CheckIcon, CopyIcon, Loader2Icon, SearchIcon } from "lucide-react";

import { Badge } from "@agentset/ui/badge";
import { Button } from "@agentset/ui/button";
import { cn } from "@agentset/ui/cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "@agentset/ui/tooltip";

export interface PaneResult {
  label: string;
  hint: string;
  messages: MyUIMessage[];
  status: "submitted" | "streaming" | "ready" | "error";
  error?: Error;
}

/** The searches this run issued, in the order the model chose them. */
const searchesOf = (messages: MyUIMessage[]) => {
  const out: { mode: string; query: string }[] = [];
  for (const m of messages) {
    for (const part of m.parts) {
      if (part.type === "tool-search" && part.input) {
        const input = part.input as { mode?: string; query?: string };
        out.push({ mode: input.mode ?? "semantic", query: input.query ?? "" });
      }
    }
  }
  return out;
};

/**
 * Retrieved chunks split by corpus. Fatwa ids are prefixed `fatwa-`; anything
 * else came from the book corpus. Counting distinct documents rather than
 * chunks answers the question a reader actually has — how many works informed
 * this answer — since one book can contribute a dozen adjacent chunks.
 */
const retrievalOf = (messages: MyUIMessage[]) => {
  const docs = new Set<string>();
  let chunks = 0;
  let fatwaChunks = 0;
  for (const m of messages) {
    for (const part of m.parts) {
      if (
        (part.type === "tool-search" || part.type === "tool-expand") &&
        part.state === "output-available"
      ) {
        // a scoped search returns `{ scope, chunks }`; a refused one returns
        // neither, and counts as no retrieval rather than as an error
        const found = chunksOfToolOutput(part.output);
        for (const chunk of found) {
          chunks++;
          if (chunk.id.startsWith("fatwa-")) fatwaChunks++;
          docs.add(chunk.documentId);
        }
      }
    }
  }
  return { docs: docs.size, chunks, fatwaChunks, books: chunks - fatwaChunks };
};

/**
 * A copy control that reports whether the copy actually happened.
 *
 * `copyText` falls back to execCommand because this app is served over plain
 * HTTP, where navigator.clipboard is undefined — so "failed" is a real outcome
 * worth showing rather than a case that never occurs.
 */
function CopyButton({
  label,
  build,
  className,
}: {
  label: string;
  build: () => string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("size-6 shrink-0", className)}
          onClick={async (e) => {
            // inside a <summary>, a click would otherwise toggle the disclosure
            e.preventDefault();
            e.stopPropagation();
            setState((await copyText(build())) ? "copied" : "failed");
            setTimeout(() => setState("idle"), 1800);
          }}
          aria-label={label}
        >
          {state === "copied" ? (
            <CheckIcon className="size-3.5 text-emerald-600" />
          ) : (
            <CopyIcon className="size-3.5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {state === "copied"
          ? "Copied"
          : state === "failed"
            ? "Copy failed"
            : label}
      </TooltipContent>
    </Tooltip>
  );
}

/** The searches as text: the count, then each query with the mode it used. */
const searchesAsText = (
  label: string,
  searches: { mode: string; query: string }[],
  retrieval: { chunks: number; docs: number },
) =>
  [
    `${label} — ${searches.length} search${searches.length === 1 ? "" : "es"}, ` +
      `${retrieval.chunks} chunks from ${retrieval.docs} documents`,
    ...searches.map((s, i) => `${i + 1}. [${s.mode}] ${s.query}`),
  ].join("\n");

/** Cost and latency as text: the totals, then the per-stage breakdown. */
const metricsAsText = (
  label: string,
  m: NonNullable<NonNullable<MyUIMessage["metadata"]>["metrics"]>,
) => {
  const ms = (v: number) =>
    v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${v}ms`;
  const usd = (v: number | null) => (v === null ? "—" : `$${v.toFixed(4)}`);
  const rows = [
    ["Query extraction", m.extraction],
    ["Query embedding", m.embedding],
    ["Retrieval", m.retrieval],
    ["Generation", m.generation],
  ] as const;
  return [
    `${label} — ${ms(m.totalMs)}, ${usd(m.totalUsd)}${m.model ? `, ${m.model}` : ""}`,
    ...rows.map(([name, s]) => {
      if (!s) return `  ${name}: —`;
      const tok =
        "tokens" in s && s.tokens
          ? `, ${s.tokens.input} in / ${s.tokens.output} out`
          : "";
      return `  ${name}: ${ms(s.ms)}, ${usd(s.usd ?? null)}${tok}`;
    }),
  ].join("\n");
};

/**
 * Copies the pane's answer.
 *
 * The citation tags are markup, not prose — they render as pills and would
 * paste as `<citation ids="turath-123#4" />`, so they are stripped. What is
 * copied is what the reader sees.
 */
function CopyAnswer({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  const copy = async () => {
    const clean = text
      .replace(/<citation\s+[^>]*?\/?>/g, "")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/ +([،.؛:!؟])/g, "$1")
      .trim();
    setState((await copyText(clean)) ? "copied" : "failed");
    setTimeout(() => setState("idle"), 1800);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0"
          onClick={copy}
          aria-label="Copy this answer"
        >
          {state === "copied" ? (
            <CheckIcon className="size-3.5 text-emerald-600" />
          ) : (
            <CopyIcon className="size-3.5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {state === "copied"
          ? "Copied"
          : state === "failed"
            ? "Copy failed"
            : "Copy answer"}
      </TooltipContent>
    </Tooltip>
  );
}

export function ComparePane({ result }: { result: PaneResult }) {
  const { messages, status, label, hint, error } = result;
  const assistant = useMemo(
    () => messages.filter((m) => m.role === "assistant").at(-1),
    [messages],
  );
  const searches = useMemo(() => searchesOf(messages), [messages]);
  const retrieval = useMemo(() => retrievalOf(messages), [messages]);

  const text = assistant?.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("");

  const busy = status === "submitted" || status === "streaming";

  return (
    <div className="flex min-w-0 flex-col rounded-lg border">
      <div className="bg-muted/40 flex items-start justify-between gap-2 rounded-t-lg border-b px-3 py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-medium">{label}</h2>
            {busy && (
              <Loader2Icon className="text-muted-foreground size-3.5 shrink-0 animate-spin" />
            )}
          </div>
          <p className="text-muted-foreground truncate text-xs">{hint}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {text && <CopyAnswer text={text} />}
          {retrieval.chunks > 0 && (
            <div className="flex shrink-0 gap-1">
              {retrieval.books > 0 && (
                <Badge variant="secondary" className="text-[11px]">
                  {retrieval.books} book
                </Badge>
              )}
              {retrieval.fatwaChunks > 0 && (
                <Badge variant="secondary" className="text-[11px]">
                  {retrieval.fatwaChunks} fatwa
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {error ? (
          <p className="text-destructive text-sm">{error.message}</p>
        ) : searches.length === 0 && !text ? (
          <p className="text-muted-foreground text-sm">
            {busy ? "Searching…" : "Ask a question to compare."}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {searches.length > 0 && (
              <details className="text-xs">
                <summary className="text-muted-foreground flex cursor-pointer items-center gap-1 select-none">
                  <span className="min-w-0 flex-1">
                    {searches.length} search{searches.length === 1 ? "" : "es"}{" "}
                    · {retrieval.chunks} chunks from {retrieval.docs} documents
                  </span>
                  <CopyButton
                    label="Copy searches"
                    build={() => searchesAsText(label, searches, retrieval)}
                  />
                </summary>
                <ul className="mt-2 flex flex-col gap-1">
                  {searches.map((s, i) => (
                    <li
                      key={i}
                      className="text-muted-foreground flex items-start gap-1.5"
                    >
                      <SearchIcon className="mt-0.5 size-3 shrink-0" />
                      <span dir="auto" className="min-w-0 break-words">
                        <span className="font-mono">{s.mode}</span> — {s.query}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {/* citations resolve against this pane's own conversation, not
                whichever chat happens to own the global store */}
            {text && assistant && (
              <ConversationMessagesProvider value={messages}>
                <ScriptureProvider>
                  <SourcesProvider message={assistant}>
                    <div className="text-sm">
                      <Markdown message={assistant} isLoading={busy}>
                        {text}
                      </Markdown>
                    </div>
                  </SourcesProvider>
                </ScriptureProvider>
              </ConversationMessagesProvider>
            )}
          </div>
        )}
      </div>

      {assistant && !busy && (
        <div className={cn("flex items-start gap-1 border-t px-3 py-2")}>
          <div className="min-w-0 flex-1">
            <MessageMetrics message={assistant} />
          </div>
          {assistant.metadata?.metrics && (
            <CopyButton
              label="Copy cost and latency"
              className="mt-1"
              build={() => metricsAsText(label, assistant.metadata!.metrics!)}
            />
          )}
        </div>
      )}
    </div>
  );
}
