import { NextResponse } from "next/server";
import { ownerFilter, resolveChatOwner } from "@/lib/chat-history";

import { db } from "@agentset/db/client";

/**
 * Lists the caller's saved corpus comparisons for a namespace, newest run
 * first.
 *
 * A comparison is several chats sharing a `comparisonId`, so this collapses
 * them into one row per run: the question is the same in all of them.
 *
 * Dated by when the run was *created*, not when it was last written. Saving a
 * pane deletes and recreates its messages, so `updatedAt` moves every time a
 * run is reopened and followed up — a run asked on the 17th showed a timestamp
 * from the 22nd, which made the history unusable for finding anything. The
 * panes of one run are created seconds apart as each first save lands, so the
 * run's own time is the earliest of them.
 */
export const GET = async (req: Request) => {
  const namespaceId = new URL(req.url).searchParams.get("namespaceId");
  if (!namespaceId) {
    return NextResponse.json(
      { error: "namespaceId required" },
      { status: 400 },
    );
  }

  const owner = await resolveChatOwner();
  const panes = await db.chat.findMany({
    where: {
      namespaceId,
      comparisonId: { not: null },
      ...ownerFilter(owner),
    },
    orderBy: { createdAt: "desc" },
    // 3 panes per comparison, so this covers the 50 most recent runs
    take: 150,
    select: {
      comparisonId: true,
      title: true,
      createdAt: true,
      // still returned so a tab running a bundle from before this field was
      // renamed reads a date rather than undefined — which rendered as
      // "Invalid Date" on every row and made runs of one question, whose
      // titles are identical, impossible to tell apart
      updatedAt: true,
      // the model that wrote the answer is only recorded in the assistant
      // turn's metrics, and one turn is enough to identify the run
      messages: {
        where: { role: "assistant" },
        orderBy: { position: "desc" },
        take: 1,
        select: { metadata: true },
      },
    },
  });

  /**
   * The answering model, from the assistant turn's stored metrics.
   *
   * `ChatMessageMetadata` is typed as `Record<string, unknown>` on the database
   * package, so the shape is narrowed here rather than asserted: a turn saved
   * before metrics existed has no model, and that is a null, not a crash.
   * The provider prefix is dropped — "google:gemini-3.5-flash" reads better as
   * "gemini-3.5-flash" in a dropdown.
   */
  const modelOf = (pane: (typeof panes)[number]): string | null => {
    const metrics = pane.messages[0]?.metadata?.metrics;
    if (typeof metrics !== "object" || metrics === null) return null;
    const model = (metrics as { model?: unknown }).model;
    return typeof model === "string" ? (model.split(":").pop() ?? null) : null;
  };

  const byId = new Map<
    string,
    {
      id: string;
      title: string | null;
      createdAt: Date;
      updatedAt: Date;
      panes: number;
      model: string | null;
    }
  >();
  for (const pane of panes) {
    const id = pane.comparisonId!;
    const seen = byId.get(id);
    if (seen) {
      seen.panes++;
      // titles are derived per pane from the same question; keep any non-null
      seen.title ??= pane.title;
      seen.model ??= modelOf(pane);
      // the run began when its first pane did
      if (pane.createdAt < seen.createdAt) seen.createdAt = pane.createdAt;
      if (pane.updatedAt > seen.updatedAt) seen.updatedAt = pane.updatedAt;
    } else {
      byId.set(id, {
        id,
        title: pane.title,
        createdAt: pane.createdAt,
        updatedAt: pane.updatedAt,
        panes: 1,
        model: modelOf(pane),
      });
    }
  }

  return NextResponse.json({ comparisons: [...byId.values()] });
};
