import { cookies, headers } from "next/headers";

import { db } from "@agentset/db/client";

import { auth } from "./auth";

/**
 * Identifies a visitor to a public hosting site across requests. Hosting sites
 * can be unauthenticated, so without this they could not have history at all.
 */
export const VISITOR_COOKIE = "agentset_visitor";

const ONE_YEAR = 60 * 60 * 24 * 365;

export type ChatOwner =
  | { userId: string; anonymousId: null }
  | { userId: null; anonymousId: string };

/**
 * Resolves who a chat belongs to. A signed-in user always wins; otherwise the
 * visitor cookie is used, and minted if this is their first request.
 */
export const resolveChatOwner = async (): Promise<ChatOwner> => {
  const session = await auth.api.getSession({ headers: await headers() });
  const jar = await cookies();

  if (session) {
    // Someone who chatted anonymously and then signed in would otherwise find
    // their history gone: it is keyed to the visitor cookie, and the cookie is
    // no longer what identifies them. Hand those chats to the account, once,
    // then drop the cookie so this does not re-run on every request.
    const visitor = jar.get(VISITOR_COOKIE)?.value;
    if (visitor) {
      await db.chat.updateMany({
        // `userId: null` guards against re-claiming a chat that already belongs
        // to an account, which could otherwise move another user's history
        where: { anonymousId: visitor, userId: null },
        data: { userId: session.user.id, anonymousId: null },
      });
      jar.delete(VISITOR_COOKIE);
    }

    return { userId: session.user.id, anonymousId: null };
  }

  const existing = jar.get(VISITOR_COOKIE)?.value;
  if (existing) return { userId: null, anonymousId: existing };

  const anonymousId = crypto.randomUUID();
  jar.set(VISITOR_COOKIE, anonymousId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR,
  });

  return { userId: null, anonymousId };
};

/** Prisma `where` clause scoping chats to one owner. */
export const ownerFilter = (owner: ChatOwner) =>
  owner.userId
    ? { userId: owner.userId }
    : { anonymousId: owner.anonymousId, userId: null };

/** First line of the first user message, used as a fallback chat title. */
export const deriveTitle = (messages: { role: string; parts: unknown }[]) => {
  const first = messages.find((m) => m.role === "user");
  if (!first || !Array.isArray(first.parts)) return null;

  for (const part of first.parts) {
    if (
      part &&
      typeof part === "object" &&
      (part as { type?: string }).type === "text"
    ) {
      const text = (part as { text?: string }).text?.trim();
      if (text) return text.slice(0, 120);
    }
  }
  return null;
};
