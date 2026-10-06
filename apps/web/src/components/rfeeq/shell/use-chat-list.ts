"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export interface ChatSummary {
  id: string;
  title: string | null;
  updatedAt: string;
}

/** The four buckets the history rail groups by, newest first. */
export const CHAT_GROUPS = [
  { key: "today", label: "اليوم" },
  { key: "yesterday", label: "أمس" },
  { key: "week", label: "آخر 7 أيام" },
  { key: "older", label: "أقدم" },
] as const;

export type ChatGroupKey = (typeof CHAT_GROUPS)[number]["key"];

const DAY = 86_400_000;

/**
 * Which bucket a conversation falls in.
 *
 * Measured against the start of today rather than a rolling 24 hours, so a chat
 * from last night reads as "أمس" at 9am instead of still counting as today —
 * which is how someone reading the list thinks about it.
 */
const groupOf = (iso: string, startOfToday: number): ChatGroupKey => {
  const time = new Date(iso).getTime();
  if (time >= startOfToday) return "today";
  if (time >= startOfToday - DAY) return "yesterday";
  if (time >= startOfToday - 6 * DAY) return "week";
  return "older";
};

/**
 * The reader's saved conversations for one corpus.
 *
 * Refetched when the active conversation changes rather than polled: the list
 * only moves when this tab finishes a turn, and a stale list costs nothing
 * until it is looked at.
 *
 * Guests are never fetched for. Their conversations do exist server-side
 * (keyed to a visitor cookie), but the design deliberately does not show them a
 * history list — it shows the current session and an invitation to sign in, so
 * that "your saved conversations" means an account rather than a browser.
 */
export function useChatList({
  namespaceId,
  activeChatId,
  enabled,
}: {
  namespaceId: string | null;
  activeChatId: string | null;
  enabled: boolean;
}) {
  const [fetched, setFetched] = useState<ChatSummary[]>([]);
  // starts true: the first render of a signed-in rail is a load in progress
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    // no namespace means the conversations that belong to no corpus, which is
    // this surface's own history — a different query from "all of them"
    void fetch(
      namespaceId ? `/api/chats?namespaceId=${namespaceId}` : "/api/chats",
    )
      .then((res) => (res.ok ? res.json() : { chats: [] }))
      .then((data: { chats: ChatSummary[] }) => {
        if (!cancelled) {
          setFetched(data.chats);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFetched([]);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, namespaceId, activeChatId]);

  /*
   * Derived rather than stored. A guest has no list to show, and writing an
   * empty array into state to express that means setting state inside an
   * effect for a value that was already knowable from the arguments.
   */
  const chats = useMemo(() => (enabled ? fetched : []), [enabled, fetched]);

  const rename = useCallback(async (chatId: string, title: string) => {
    const next = title.trim();
    if (!next) return;

    // optimistic: the row is being edited in place, and a round trip before the
    // new name appears reads as the rename having failed
    setFetched((current) =>
      current.map((chat) =>
        chat.id === chatId ? { ...chat, title: next } : chat,
      ),
    );

    const res = await fetch(`/api/chats/${chatId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: next }),
    });
    if (!res.ok) toast.error("تعذّر تغيير اسم المحادثة");
  }, []);

  const remove = useCallback(async (chatId: string) => {
    setFetched((current) => current.filter((chat) => chat.id !== chatId));

    const res = await fetch(`/api/chats/${chatId}`, { method: "DELETE" });
    if (!res.ok) toast.error("تعذّر حذف المحادثة");
  }, []);

  const grouped = useMemo(() => {
    const term = query.trim();
    const matching = term
      ? chats.filter((chat) => (chat.title ?? "").includes(term))
      : chats;

    const startOfToday = new Date().setHours(0, 0, 0, 0);

    return CHAT_GROUPS.map((group) => ({
      ...group,
      chats: matching.filter(
        (chat) => groupOf(chat.updatedAt, startOfToday) === group.key,
      ),
    })).filter((group) => group.chats.length > 0);
  }, [chats, query]);

  return {
    chats,
    grouped,
    loading,
    query,
    setQuery,
    rename,
    remove,
    /** True when a search is active but matched nothing — a distinct empty state. */
    noMatches:
      query.trim().length > 0 && grouped.length === 0 && chats.length > 0,
  };
}
