import { NextResponse } from "next/server";
import { ownerFilter, resolveChatOwner } from "@/lib/chat-history";
import { z } from "zod/v4";

import { db } from "@agentset/db/client";

const findOwned = async (chatId: string) => {
  const owner = await resolveChatOwner();
  return db.chat.findFirst({
    where: { id: chatId, ...ownerFilter(owner) },
    select: {
      id: true,
      title: true,
      namespaceId: true,
      updatedAt: true,
      messages: {
        orderBy: { position: "asc" },
        select: { id: true, role: true, parts: true, metadata: true },
      },
    },
  });
};

/** Load one saved conversation, restoring the raw UIMessage parts. */
export const GET = async (
  _req: Request,
  { params }: { params: Promise<{ chatId: string }> },
) => {
  const { chatId } = await params;
  const chat = await findOwned(chatId);
  if (!chat) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({
    chat: {
      id: chat.id,
      title: chat.title,
      namespaceId: chat.namespaceId,
      updatedAt: chat.updatedAt,
      messages: chat.messages.map((m) => ({
        id: m.id,
        role: m.role,
        parts: m.parts,
        // omitted entirely when absent, so a restored message matches the shape
        // of a live one — whose metadata is undefined until the run finishes
        ...(m.metadata ? { metadata: m.metadata } : {}),
      })),
    },
  });
};

const renameSchema = z.object({
  /*
   * Trimmed and capped, because this is a free-text field the owner types and
   * it is rendered back into a single-line row. 120 characters is past the
   * point the row can show anyway.
   */
  title: z.string().trim().min(1).max(120),
});

/**
 * Rename a saved conversation.
 *
 * Added for the history rail, which lets the owner retitle a chat in place.
 * Scoped through `findOwned` like the other two handlers, so a rename cannot
 * reach a conversation the caller does not own.
 */
export const PATCH = async (
  req: Request,
  { params }: { params: Promise<{ chatId: string }> },
) => {
  const { chatId } = await params;
  const chat = await findOwned(chatId);
  if (!chat) return NextResponse.json({ error: "not found" }, { status: 404 });

  const parsed = renameSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const updated = await db.chat.update({
    where: { id: chat.id },
    data: { title: parsed.data.title },
    select: { id: true, title: true, updatedAt: true },
  });

  return NextResponse.json({ chat: updated });
};

export const DELETE = async (
  _req: Request,
  { params }: { params: Promise<{ chatId: string }> },
) => {
  const { chatId } = await params;
  const chat = await findOwned(chatId);
  if (!chat) return NextResponse.json({ error: "not found" }, { status: 404 });

  await db.chat.delete({ where: { id: chat.id } });
  return NextResponse.json({ ok: true });
};
