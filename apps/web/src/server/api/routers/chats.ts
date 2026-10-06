import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { getNamespaceByUser } from "../auth";

/**
 * Confirms the caller may read *other people's* conversations in this namespace.
 *
 * Namespace membership alone is deliberately not enough. Documents are the
 * organisation's own material, but saved chats are what visitors asked — often
 * personal religious questions — so this is gated on an owner/admin role rather
 * than reusing the looser check the document routes use.
 */
const requireNamespaceAdmin = async (
  ctx: Parameters<typeof getNamespaceByUser>[0],
  namespaceId: string,
) => {
  const namespace = await getNamespaceByUser(ctx, { id: namespaceId });
  if (!namespace) throw new TRPCError({ code: "NOT_FOUND" });

  const membership = await ctx.db.member.findFirst({
    where: {
      organizationId: namespace.organizationId,
      userId: ctx.session.user.id,
      role: { in: ["owner", "admin"] },
    },
    select: { role: true },
  });
  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Only organization owners and admins can view all conversations.",
    });
  }

  return namespace;
};

export const chatsRouter = createTRPCRouter({
  /** Every saved conversation in the namespace, newest first. */
  all: protectedProcedure
    .input(
      z.object({
        namespaceId: z.string(),
        // simple offset paging: the list is browsed, not streamed
        limit: z.number().min(1).max(200).optional().default(50),
        offset: z.number().min(0).optional().default(0),
        search: z.string().trim().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const namespace = await requireNamespaceAdmin(ctx, input.namespaceId);

      const where = {
        namespaceId: namespace.id,
        ...(input.search
          ? {
              OR: [
                {
                  title: {
                    contains: input.search,
                    mode: "insensitive" as const,
                  },
                },
                {
                  messages: {
                    some: {
                      parts: {
                        string_contains: input.search,
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      };

      const [chats, total] = await Promise.all([
        ctx.db.chat.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          take: input.limit,
          skip: input.offset,
          select: {
            id: true,
            title: true,
            createdAt: true,
            updatedAt: true,
            hostingId: true,
            anonymousId: true,
            user: { select: { id: true, name: true, email: true } },
            _count: { select: { messages: true } },
          },
        }),
        ctx.db.chat.count({ where }),
      ]);

      return {
        total,
        chats: chats.map((c) => ({
          id: c.id,
          title: c.title,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          messageCount: c._count.messages,
          surface: c.hostingId ? ("hosting" as const) : ("playground" as const),
          // an anonymous visitor has no account; show a short stable handle
          // rather than the raw cookie id
          who: c.user
            ? {
                kind: "user" as const,
                label: c.user.email ?? c.user.name ?? c.user.id,
              }
            : {
                kind: "anonymous" as const,
                label: c.anonymousId
                  ? `visitor ${c.anonymousId.slice(0, 8)}`
                  : "visitor",
              },
        })),
      };
    }),

  /** One conversation in full, including the per-answer cost/latency metrics. */
  byId: protectedProcedure
    .input(z.object({ namespaceId: z.string(), chatId: z.string() }))
    .query(async ({ ctx, input }) => {
      const namespace = await requireNamespaceAdmin(ctx, input.namespaceId);

      const chat = await ctx.db.chat.findFirst({
        // scoped to the namespace so a chat id from elsewhere cannot be read
        where: { id: input.chatId, namespaceId: namespace.id },
        select: {
          id: true,
          title: true,
          createdAt: true,
          updatedAt: true,
          hostingId: true,
          anonymousId: true,
          user: { select: { name: true, email: true } },
          messages: {
            orderBy: { position: "asc" },
            select: {
              id: true,
              role: true,
              parts: true,
              metadata: true,
              createdAt: true,
            },
          },
        },
      });
      if (!chat) throw new TRPCError({ code: "NOT_FOUND" });

      return chat;
    }),
});
