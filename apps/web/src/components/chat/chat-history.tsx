"use client";

import type { MyUIMessage } from "@/types/ai";
import { useCallback, useEffect, useState } from "react";
import { useChatProperty } from "ai-sdk-zustand";
import { HistoryIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@agentset/ui/button";
import { cn } from "@agentset/ui/cn";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@agentset/ui/sheet";

import { useActiveChat } from "./active-chat.store";

interface ChatSummary {
  id: string;
  title: string | null;
  updatedAt: string;
}

const formatWhen = (iso: string) => {
  const date = new Date(iso);
  const minutes = (Date.now() - date.getTime()) / 60000;
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${Math.floor(minutes)}m ago`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h ago`;
  return date.toLocaleDateString();
};

/**
 * Past conversations for this namespace, scoped to the caller — a signed-in
 * user sees their own, a public visitor sees the ones from their browser.
 */
export const ChatHistory = ({ namespaceId }: { namespaceId: string }) => {
  const [open, setOpen] = useState(false);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const setMessages = useChatProperty((s) => s.setMessages);
  const activeChatId = useActiveChat((s) => s.chatId);
  const setChatId = useActiveChat((s) => s.setChatId);

  // refreshed on open rather than polled: the list only changes when this tab
  // finishes a turn, and a stale list is harmless until reopened
  useEffect(() => {
    if (!open) return;

    setLoading(true);
    void fetch(`/api/chats?namespaceId=${namespaceId}`)
      .then((res) => (res.ok ? res.json() : { chats: [] }))
      .then((data: { chats: ChatSummary[] }) => setChats(data.chats))
      .catch(() => setChats([]))
      .finally(() => setLoading(false));
  }, [open, namespaceId, activeChatId]);

  const loadChat = useCallback(
    async (chatId: string) => {
      try {
        const res = await fetch(`/api/chats/${chatId}`);
        if (!res.ok) throw new Error("not found");

        const { chat } = (await res.json()) as {
          chat: {
            messages: {
              id: string;
              role: string;
              parts: unknown;
              // cost/latency breakdown; absent on user turns and on chats
              // saved before metrics were persisted
              metadata?: unknown;
            }[];
          };
        };

        setMessages(chat.messages as unknown as MyUIMessage[]);
        setChatId(chatId);
        setOpen(false);
      } catch {
        toast.error("Couldn't load that conversation");
      }
    },
    [setMessages, setChatId],
  );

  const newChat = useCallback(() => {
    setMessages([]);
    setChatId(null);
    setOpen(false);
  }, [setMessages, setChatId]);

  const deleteChat = useCallback(
    async (chatId: string) => {
      setChats((current) => current.filter((c) => c.id !== chatId));
      // the open conversation was just deleted; keep it on screen but detach
      // it so the next turn starts a new record rather than resurrecting this
      if (chatId === activeChatId) setChatId(null);

      const res = await fetch(`/api/chats/${chatId}`, { method: "DELETE" });
      if (!res.ok) toast.error("Couldn't delete that conversation");
    },
    [activeChatId, setChatId],
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Chat history">
          <HistoryIcon className="size-4" />
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full gap-0 sm:max-w-sm">
        <SheetHeader className="border-border border-b">
          <SheetTitle>History</SheetTitle>
        </SheetHeader>

        <div className="p-3">
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={newChat}
          >
            <PlusIcon className="size-4" />
            New chat
          </Button>
        </div>

        <div className="overflow-y-auto px-3 pb-3">
          {loading && chats.length === 0 ? (
            <p className="text-muted-foreground px-1 py-3 text-sm">Loading…</p>
          ) : chats.length === 0 ? (
            <p className="text-muted-foreground px-1 py-3 text-sm">
              No saved conversations yet.
            </p>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id}
                className={cn(
                  "group hover:bg-accent flex items-center gap-2 rounded-md px-2 py-2",
                  chat.id === activeChatId && "bg-accent",
                )}
              >
                <button
                  type="button"
                  dir="auto"
                  onClick={() => void loadChat(chat.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-sm">
                    {chat.title ?? "Untitled"}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {formatWhen(chat.updatedAt)}
                  </span>
                </button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Delete conversation"
                  onClick={() => void deleteChat(chat.id)}
                >
                  <Trash2Icon className="size-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
