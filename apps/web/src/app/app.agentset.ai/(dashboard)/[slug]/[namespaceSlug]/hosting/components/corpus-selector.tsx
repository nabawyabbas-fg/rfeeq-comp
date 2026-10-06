"use client";

import { useParams } from "next/navigation";
import { useNamespace } from "@/hooks/use-namespace";
import { useTRPC } from "@/trpc/react";
import { useQuery } from "@tanstack/react-query";

import type { RetrievalMode } from "@agentset/db";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@agentset/ui/select";

/**
 * The retrieval mode and the second corpus are one choice to an admin ("search
 * the books, the fatwas, or both"), so they are one control here and are split
 * back into `retrievalMode` + `secondaryNamespaceId` on submit.
 */
export const PRIMARY_ONLY = "PRIMARY";

export const encodeCorpus = (
  mode: RetrievalMode,
  secondaryNamespaceId: string | null | undefined,
) =>
  // TERTIARY exists for the comparison playground, which has a third corpus to
  // point at. Hosting carries only secondaryNamespaceId, so a site left in that
  // mode has nothing to search but its own namespace — which is PRIMARY_ONLY.
  // The selector below never offers it, so this is a guard, not a path.
  mode === "PRIMARY" || mode === "TERTIARY" || !secondaryNamespaceId
    ? PRIMARY_ONLY
    : `${mode}:${secondaryNamespaceId}`;

export const decodeCorpus = (value: string) => {
  if (value === PRIMARY_ONLY) {
    return { retrievalMode: "PRIMARY" as const, secondaryNamespaceId: null };
  }
  const [mode, id] = value.split(":");
  return {
    retrievalMode: mode as "SECONDARY" | "BOTH",
    secondaryNamespaceId: id ?? null,
  };
};

export function CorpusSelector({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (value: string) => void;
}) {
  const params = useParams();
  const namespace = useNamespace();
  const trpc = useTRPC();
  const { data: namespaces } = useQuery(
    trpc.namespace.getOrgNamespaces.queryOptions({
      slug: params.slug as string,
    }),
  );

  const others = (namespaces ?? []).filter((n) => n.id !== namespace.id);

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={PRIMARY_ONLY}>
          {namespace.name} (this knowledge base)
        </SelectItem>
        {others.map((n) => (
          <SelectItem key={n.id} value={`SECONDARY:${n.id}`}>
            {n.name}
          </SelectItem>
        ))}
        {others.map((n) => (
          <SelectItem key={`both-${n.id}`} value={`BOTH:${n.id}`}>
            {namespace.name} + {n.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
