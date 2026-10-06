import { NextResponse } from "next/server";
import { ownerFilter, resolveChatOwner } from "@/lib/chat-history";
import { nanoid } from "nanoid";

import { db } from "@agentset/db/client";

/**
 * Finds the conversation, scoped to whoever is asking.
 *
 * The same ownership check the read, rename and delete handlers use. Sharing is
 * the one operation that *publishes*, so it must not be reachable for a
 * conversation the caller does not own — a visitor cookie or a session id is
 * what establishes that.
 */
const findOwned = async (chatId: string) => {
  const owner = await resolveChatOwner();
  return db.chat.findFirst({
    where: { id: chatId, ...ownerFilter(owner) },
    select: { id: true, shareId: true },
  });
};

/**
 * Share a conversation, returning its public link key.
 *
 * Idempotent: a conversation that is already shared returns the key it already
 * has rather than minting a second one, so pressing share twice does not
 * quietly invalidate the link already sent to someone.
 *
 * 21 characters from nanoid's URL-safe alphabet — unguessable, which is what
 * carries the access control here. There is no per-recipient permission: the
 * link is the capability, and the page it opens says so plainly.
 */
export const POST = async (
  _req: Request,
  { params }: { params: Promise<{ chatId: string }> },
) => {
  const { chatId } = await params;
  const chat = await findOwned(chatId);
  if (!chat) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (chat.shareId) {
    return NextResponse.json({ shareId: chat.shareId });
  }

  const shareId = nanoid(21);
  await db.chat.update({
    where: { id: chat.id },
    data: { shareId, sharedAt: new Date() },
  });

  return NextResponse.json({ shareId });
};

/**
 * Stop sharing.
 *
 * Clears the key, which breaks every link already handed out and leaves the
 * conversation itself untouched. Sharing again mints a new key rather than
 * restoring the old one — a revoked link staying dead is the whole point.
 */
export const DELETE = async (
  _req: Request,
  { params }: { params: Promise<{ chatId: string }> },
) => {
  const { chatId } = await params;
  const chat = await findOwned(chatId);
  if (!chat) return NextResponse.json({ error: "not found" }, { status: 404 });

  await db.chat.update({
    where: { id: chat.id },
    data: { shareId: null, sharedAt: null },
  });

  return NextResponse.json({ ok: true });
};
