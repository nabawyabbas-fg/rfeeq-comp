import { NextResponse } from "next/server";
import { deriveTitle, ownerFilter, resolveChatOwner } from "@/lib/chat-history";
import { saveIsNoOp } from "@/lib/chat-save";
import { z } from "zod/v4";

import { db } from "@agentset/db/client";

/**
 * List the caller's saved chats, most recent first.
 *
 * `namespaceId` scopes to one corpus. Omitting it means the conversations that
 * belong to no corpus — the Rfeeq consumer surface, which retrieves live — and
 * is a different query from "all of them": a reader's chat history should not
 * mix the two.
 */
export const GET = async (req: Request) => {
  const namespaceId = new URL(req.url).searchParams.get("namespaceId");

  const owner = await resolveChatOwner();
  const chats = await db.chat.findMany({
    // comparison panes have their own history view; three near-identical rows
    // per run would otherwise swamp the ordinary chat list
    where: {
      namespaceId: namespaceId ?? null,
      comparisonId: null,
      ...ownerFilter(owner),
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, title: true, updatedAt: true },
  });

  return NextResponse.json({ chats });
};

const saveSchema = z.object({
  chatId: z.string().optional(),
  /** Absent for a surface with no corpus; stored as null. */
  namespaceId: z.string().optional(),
  hostingId: z.string().optional(),
  /** Set by the corpus comparison; every pane of a run shares one id. */
  comparisonId: z.string().optional(),
  retrievalMode: z
    .enum(["PRIMARY", "SECONDARY", "TERTIARY", "BOTH"])
    .optional(),
  messages: z
    .array(
      z.object({
        role: z.string(),
        parts: z.array(z.unknown()),
        // carries the per-answer cost/latency breakdown on assistant turns
        metadata: z.record(z.string(), z.unknown()).nullish(),
      }),
    )
    .min(1),
});

/**
 * Creates or replaces a saved conversation.
 *
 * Messages are rewritten wholesale rather than appended: a turn can be edited
 * or regenerated in the UI, which rewrites history rather than extending it,
 * so replace-all is both simpler and the only correct option.
 */
export const POST = async (req: Request) => {
  const parsed = saveSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const {
    chatId,
    namespaceId,
    hostingId,
    comparisonId,
    retrievalMode,
    messages,
  } = parsed.data;
  const owner = await resolveChatOwner();
  const title = deriveTitle(messages);

  const rows = messages.map((message, position) => ({
    role: message.role,
    parts: message.parts as PrismaJson.ChatMessageParts,
    // omitted rather than set to null: Prisma distinguishes SQL NULL from JSON
    // null on nullable Json columns, and omitting leaves the column NULL
    ...(message.metadata
      ? { metadata: message.metadata as PrismaJson.ChatMessageMetadata }
      : {}),
    position,
  }));

  // only touch a chat the caller owns
  const existing = chatId
    ? await db.chat.findFirst({
        // `?? null` matters: an undefined filter is dropped by Prisma, which
        // would match a chat belonging to a different corpus
        where: {
          id: chatId,
          namespaceId: namespaceId ?? null,
          ...ownerFilter(owner),
        },
        select: { id: true },
      })
    : null;

  if (existing) {
    /*
     * A save that changes nothing must not touch the record.
     *
     * `updatedAt` is what the history rail sorts on, so a write here is what
     * decides a conversation's place in the list. Loading a conversation puts
     * its messages into the client's state with the run already finished, which
     * is exactly the shape the persistence hook saves — so merely *opening* an
     * old conversation posted it straight back and floated it to the top. The
     * rail sorted by last opened while claiming to sort by last changed.
     *
     * The guard is here rather than only in the client because the client
     * cannot be sure of its own ordering: the messages and the chat id are set
     * from two different stores, and when the messages land a render later the
     * hook has already recorded an empty conversation as "saved" and dutifully
     * writes the real one a moment after. Comparing against what is stored is
     * the one check that cannot be raced.
     *
     * The last row is enough to decide it. A new turn changes the count; a
     * regenerated turn changes the last row's parts; the metrics that arrive a
     * beat after the stream finishes change its metadata — and that one matters,
     * because dropping it would leave half the turns without their cost and
     * latency recorded.
     */
    /*
     * Two reads, split by cost. Every row's `metadata` is needed — the metrics
     * and the follow-up suggestions both land there, and the suggestions attach
     * to whichever answer produced them, not necessarily the newest. Metadata
     * is a few hundred bytes a row; `parts` is the whole conversation, so only
     * the last row's is fetched, which is the only one that can change without
     * the count changing.
     */
    const [stored, [last]] = await Promise.all([
      db.chatMessage.findMany({
        where: { chatId: existing.id },
        select: { position: true, metadata: true },
      }),
      db.chatMessage.findMany({
        where: { chatId: existing.id },
        orderBy: { position: "desc" },
        take: 1,
        select: { parts: true },
      }),
    ]);

    if (saveIsNoOp(stored, last?.parts, rows)) {
      const chat = await db.chat.findUniqueOrThrow({
        where: { id: existing.id },
        select: { id: true, title: true, updatedAt: true },
      });
      return NextResponse.json({ chat });
    }

    const [, chat] = await db.$transaction([
      db.chatMessage.deleteMany({ where: { chatId: existing.id } }),
      db.chat.update({
        where: { id: existing.id },
        data: {
          title,
          ...(comparisonId ? { comparisonId, retrievalMode } : {}),
          messages: { create: rows },
        },
        select: { id: true, title: true, updatedAt: true },
      }),
    ]);
    return NextResponse.json({ chat });
  }

  const chat = await db.chat.create({
    data: {
      namespaceId: namespaceId ?? null,
      hostingId,
      comparisonId,
      retrievalMode,
      title,
      userId: owner.userId,
      anonymousId: owner.anonymousId,
      messages: { create: rows },
    },
    select: { id: true, title: true, updatedAt: true },
  });

  return NextResponse.json({ chat });
};

/**
 * Clear the caller's saved conversations.
 *
 * Scoped by the same owner filter as the listing, so it can only ever reach
 * conversations the caller owns — a signed-in reader's own, or an anonymous
 * visitor's own. Offered on the privacy screen, where the brief's الخصوصية
 * criterion asks that what the system holds about a reader be theirs to remove.
 */
export const DELETE = async () => {
  const owner = await resolveChatOwner();
  const { count } = await db.chat.deleteMany({ where: ownerFilter(owner) });
  return NextResponse.json({ deleted: count });
};
