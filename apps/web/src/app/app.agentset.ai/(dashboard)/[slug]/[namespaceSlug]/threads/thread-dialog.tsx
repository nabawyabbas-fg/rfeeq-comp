"use client";

import { useTRPC } from "@/trpc/react";
import { useQuery } from "@tanstack/react-query";

import { cn } from "@agentset/ui/cn";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@agentset/ui/dialog";
import { Skeleton } from "@agentset/ui/skeleton";

/** Pulls the readable text out of a stored UIMessage `parts` array. */
const textOf = (parts: unknown): string => {
  if (!Array.isArray(parts)) return "";
  return parts
    .filter(
      (p): p is { type: string; text?: string } =>
        !!p &&
        typeof p === "object" &&
        (p as { type?: string }).type === "text",
    )
    .map((p) => p.text ?? "")
    .join("\n")
    .trim();
};

const usd = (v: unknown) =>
  typeof v === "number" ? `$${v < 0.01 ? v.toFixed(4) : v.toFixed(3)}` : null;
const secs = (v: unknown) =>
  typeof v === "number" ? `${(v / 1000).toFixed(1)}s` : null;

export function ThreadDialog({
  namespaceId,
  chatId,
  onClose,
}: {
  namespaceId: string;
  chatId: string | null;
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery({
    ...trpc.chats.byId.queryOptions({ namespaceId, chatId: chatId ?? "" }),
    enabled: !!chatId,
  });

  return (
    <Dialog open={!!chatId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl" scrollableOverlay>
        <DialogHeader>
          <DialogTitle dir="auto">
            {data?.title ?? (isLoading ? "Loading…" : "Conversation")}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : !data ? (
          <p className="text-muted-foreground text-sm">Not found.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-muted-foreground text-xs">
              {data.user?.email ??
                (data.anonymousId
                  ? `visitor ${data.anonymousId.slice(0, 8)}`
                  : "visitor")}{" "}
              · {data.hostingId ? "hosting" : "playground"} ·{" "}
              {new Date(data.createdAt).toLocaleString()}
            </p>

            {data.messages.map((m) => {
              // metrics are stored only on assistant turns, and only for turns
              // recorded after the breakdown began being persisted
              const metrics = (
                m.metadata as { metrics?: Record<string, unknown> } | null
              )?.metrics;
              const body = textOf(m.parts);

              return (
                <div
                  key={m.id}
                  className={cn(
                    "rounded-lg border px-3 py-2",
                    m.role === "user"
                      ? "bg-muted/40 border-border"
                      : "border-border",
                  )}
                >
                  <p className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-wide uppercase">
                    {m.role}
                  </p>
                  <div className="text-sm whitespace-pre-wrap" dir="auto">
                    {body || (
                      <span className="text-muted-foreground italic">
                        (no text content)
                      </span>
                    )}
                  </div>

                  {metrics ? (
                    <p className="text-muted-foreground mt-2 text-xs tabular-nums">
                      {[
                        secs(metrics.totalMs),
                        usd(metrics.totalUsd),
                        typeof metrics.model === "string"
                          ? metrics.model
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
