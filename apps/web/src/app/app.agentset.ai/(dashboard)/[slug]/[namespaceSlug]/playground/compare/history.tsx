"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { HistoryIcon, Loader2Icon, Trash2Icon } from "lucide-react";

import { Button } from "@agentset/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@agentset/ui/dropdown-menu";

export interface SavedComparison {
  id: string;
  title: string | null;
  /** When the run was asked, not when it was last written back. */
  createdAt: string;
  panes: number;
  /** The model that wrote the answers, without its provider prefix. */
  model: string | null;
}

/**
 * Relative while that is the more useful reading, then the date and time.
 *
 * Older runs get a clock time as well as a date: several runs of the same
 * question on one day are common, and a bare date cannot tell them apart.
 */
const when = (iso: string) => {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

/** Full timestamp, for the hover title. */
const exact = (iso: string) => new Date(iso).toLocaleString();

export function ComparisonHistory({
  namespaceId,
  onSelect,
  onDeleted,
}: {
  namespaceId: string;
  onSelect: (id: string) => void;
  /** Lets the page clear the panes when the run on screen is the one deleted. */
  onDeleted?: (id: string) => void;
}) {
  const { data, refetch, isFetching } = useQuery({
    queryKey: ["comparisons", namespaceId],
    queryFn: async () => {
      const res = await fetch(`/api/comparisons?namespaceId=${namespaceId}`);
      if (!res.ok) throw new Error("failed to load comparisons");
      return (await res.json()) as { comparisons: SavedComparison[] };
    },
  });

  const { mutate: remove, variables: deleting } = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/comparisons/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("failed to delete comparison");
      return id;
    },
    onSuccess: (id) => {
      onDeleted?.(id);
      void refetch();
    },
  });

  const comparisons = data?.comparisons ?? [];

  return (
    <DropdownMenu onOpenChange={(open) => open && void refetch()}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <HistoryIcon className="size-4" />
          History
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-96 w-80 overflow-y-auto"
      >
        {comparisons.length === 0 ? (
          <div className="text-muted-foreground px-2 py-3 text-center text-sm">
            {isFetching ? "Loading…" : "No saved comparisons yet"}
          </div>
        ) : (
          comparisons.map((c) => (
            <DropdownMenuItem
              key={c.id}
              onSelect={() => onSelect(c.id)}
              className="group/run flex flex-col items-start gap-0.5"
            >
              <div className="flex w-full items-start gap-1">
                <span dir="auto" className="min-w-0 flex-1 truncate text-sm">
                  {c.title ?? "Untitled comparison"}
                </span>
                {/*
                 * Deleting must not also open the run, which is what the item's
                 * own onSelect would do — so the event is stopped here rather
                 * than relying on the menu closing first.
                 */}
                <button
                  type="button"
                  aria-label="Delete this run"
                  title="Delete this run"
                  disabled={deleting === c.id}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    remove(c.id);
                  }}
                  className="text-muted-foreground hover:text-destructive focus-visible:text-destructive -mr-1 shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover/run:opacity-100 focus-visible:opacity-100"
                >
                  {deleting === c.id ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2Icon className="size-3.5" />
                  )}
                </button>
              </div>
              <span className="text-muted-foreground flex w-full items-center gap-1.5 text-xs">
                {/* Runs of one question share a title, so the time alone cannot
                    tell them apart. The model is what actually distinguishes
                    them, which is the reason to compare saved runs at all. */}
                {c.model && (
                  <span className="bg-muted text-foreground/70 rounded px-1 py-px font-mono text-[10px]">
                    {c.model}
                  </span>
                )}
                <span title={exact(c.createdAt)}>{when(c.createdAt)}</span>
                {/* a run that errored on one corpus saved fewer than three */}
                {c.panes < 3 && <span>· {c.panes} of 3 panes</span>}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
