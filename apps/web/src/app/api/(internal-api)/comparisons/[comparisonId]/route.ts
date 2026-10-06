import { NextResponse } from "next/server";
import { ownerFilter, resolveChatOwner } from "@/lib/chat-history";

import { db } from "@agentset/db/client";

/** Loads every pane of one saved comparison, keyed by retrieval mode. */
export const GET = async (
  _req: Request,
  { params }: { params: Promise<{ comparisonId: string }> },
) => {
  const { comparisonId } = await params;
  const owner = await resolveChatOwner();

  const rows = await db.chat.findMany({
    where: { comparisonId, ...ownerFilter(owner) },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      retrievalMode: true,
      updatedAt: true,
      messages: {
        orderBy: { position: "asc" },
        select: { role: true, parts: true, metadata: true, position: true },
      },
    },
  });

  if (rows.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // One pane per retrieval mode. Runs saved before the client learned to reuse
  // its chat record left several rows per mode; newest wins, so a restored
  // comparison shows the version the user last saw rather than an arbitrary one.
  const panes = [...new Map(rows.map((r) => [r.retrievalMode, r])).values()];

  return NextResponse.json({
    comparison: {
      id: comparisonId,
      title: panes.find((p) => p.title)?.title ?? null,
      panes: panes.map((pane) => ({
        // returned so the client can keep writing to this record instead of
        // creating another one on the next turn
        chatId: pane.id,
        retrievalMode: pane.retrievalMode,
        // rebuilt into UIMessages client-side; ids only need to be stable
        // within the pane for React keys and citation lookups
        messages: pane.messages.map((m, i) => ({
          id: `${pane.id}-${i}`,
          role: m.role,
          parts: m.parts,
          ...(m.metadata ? { metadata: m.metadata } : {}),
        })),
      })),
    },
  });
};

/**
 * Deletes every pane of one saved comparison.
 *
 * Scoped to the caller the same way the read is, so a comparison id alone is
 * not enough to destroy someone else's run. The chat rows are what get deleted;
 * their messages follow via the cascade on `chat_message.chatId`.
 */
export const DELETE = async (
  _req: Request,
  { params }: { params: Promise<{ comparisonId: string }> },
) => {
  const { comparisonId } = await params;
  const owner = await resolveChatOwner();

  const { count } = await db.chat.deleteMany({
    where: { comparisonId, ...ownerFilter(owner) },
  });

  if (count === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ deleted: count });
};
