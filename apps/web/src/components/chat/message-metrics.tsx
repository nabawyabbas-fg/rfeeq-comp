"use client";

import type { MyUIMessage } from "@/types/ai";
import { useState } from "react";
import { ChevronDownIcon, ClockIcon } from "lucide-react";

import { cn } from "@agentset/ui/cn";

const ms = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${v}ms`);

/** Cost renders as "—" when a model's price isn't configured, never as $0.00. */
const usd = (v: number | null) =>
  v === null ? "—" : v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(3)}`;

const ROWS = [
  ["Query extraction", "extraction"],
  ["Query embedding", "embedding"],
  ["Retrieval", "retrieval"],
  ["Generation", "generation"],
] as const;

/**
 * Per-answer cost and latency by stage.
 *
 * Extraction and generation come from the same streamText call, split by step:
 * steps ending in a tool call were the model deciding what to search, the final
 * step is the answer.
 */
export const MessageMetrics = ({ message }: { message: MyUIMessage }) => {
  const [open, setOpen] = useState(false);
  const m = message.metadata?.metrics;
  if (!m) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs transition-colors"
      >
        <ClockIcon className="size-3" />
        {ms(m.totalMs)}
        <span className="opacity-60">·</span>
        {usd(m.totalUsd)}
        <ChevronDownIcon
          className={cn("size-3 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="border-border mt-2 rounded-md border text-xs">
          <table className="w-full">
            <thead className="text-muted-foreground border-border border-b">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium">Stage</th>
                <th className="px-3 py-1.5 text-right font-medium">Latency</th>
                <th className="px-3 py-1.5 text-right font-medium">Tokens</th>
                <th className="px-3 py-1.5 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([label, key]) => {
                const s = m[key];
                return (
                  <tr
                    key={key}
                    className="border-border/50 border-b last:border-0"
                  >
                    <td className="px-3 py-1.5">
                      {label}
                      {s.calls ? (
                        <span className="text-muted-foreground">
                          {" "}
                          ×{s.calls}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {ms(s.ms)}
                    </td>
                    <td className="text-muted-foreground px-3 py-1.5 text-right tabular-nums">
                      {s.tokens
                        ? `${s.tokens.input.toLocaleString()} in / ${s.tokens.output.toLocaleString()} out`
                        : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {usd(s.usd)}
                    </td>
                  </tr>
                );
              })}
              <tr className="font-medium">
                <td className="px-3 py-1.5">Total</td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {ms(m.totalMs)}
                </td>
                <td className="px-3 py-1.5" />
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {usd(m.totalUsd)}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="text-muted-foreground border-border border-t px-3 py-1.5">
            {m.model}
            {/* only worth naming when a second model chose the searches */}
            {m.extractionModel && m.extractionModel !== m.model && (
              <> · search: {m.extractionModel}</>
            )}{" "}
            · {m.embeddingModel}
            {m.totalUsd === null && (
              <span className="ml-2">
                — cost unavailable: no price configured for this model
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
