"use client";

import { useState } from "react";
import { useNamespace } from "@/hooks/use-namespace";
import { useTRPC } from "@/trpc/react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@agentset/ui/button";
import { Input } from "@agentset/ui/input";
import { Skeleton } from "@agentset/ui/skeleton";

import { ThreadDialog } from "./thread-dialog";

const PAGE = 25;

const when = (d: string | Date) =>
  new Date(d).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function ThreadsPageClient() {
  const namespace = useNamespace();
  const trpc = useTRPC();
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery(
    trpc.chats.all.queryOptions({
      namespaceId: namespace.id,
      limit: PAGE,
      offset,
      ...(search.trim() ? { search: search.trim() } : {}),
    }),
  );

  if (error) {
    return (
      <p className="text-destructive text-sm">
        {error.message ||
          "Couldn't load conversations. Owner or admin access is required."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search titles and messages…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOffset(0); // a new filter invalidates the current page
          }}
          className="max-w-sm"
          dir="auto"
        />
        {data ? (
          <span className="text-muted-foreground text-sm">
            {data.total} conversation{data.total === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : !data || data.chats.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {search
            ? "No conversations match that search."
            : "No conversations yet."}
        </p>
      ) : (
        <div className="border-border divide-border divide-y rounded-lg border">
          {data.chats.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setOpenId(c.id)}
              className="hover:bg-muted/50 flex w-full items-center gap-4 px-4 py-3 text-left transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" dir="auto">
                  {c.title ?? "(untitled)"}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {c.who.label} · {c.surface} · {c.messageCount} message
                  {c.messageCount === 1 ? "" : "s"}
                </p>
              </div>
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {when(c.updatedAt)}
              </span>
            </button>
          ))}
        </div>
      )}

      {data && data.total > PAGE ? (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - PAGE))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={offset + PAGE >= data.total}
            onClick={() => setOffset((o) => o + PAGE)}
          >
            Next
          </Button>
          <span className="text-muted-foreground text-xs tabular-nums">
            {offset + 1}–{Math.min(offset + PAGE, data.total)} of {data.total}
          </span>
        </div>
      ) : null}

      <ThreadDialog
        namespaceId={namespace.id}
        chatId={openId}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}
