"use client";

import type { MyUIMessage } from "@/types/ai";
import { useEffect, useRef } from "react";
import { useActiveChat } from "@/components/chat/active-chat.store";
import { useChatProperty } from "ai-sdk-zustand";
import { toast } from "sonner";

/**
 * Loads a conversation named in the URL into the chat store.
 *
 * Runs once per id. The guard matters: the store's `messages` changes on every
 * streamed chunk, and a hook that re-ran on that would replace the conversation
 * mid-answer with its saved version.
 *
 * Ownership is checked server-side by the route this fetches — a chat id in
 * somebody else's URL answers 404, which lands the reader on an empty chat
 * rather than on someone else's.
 */
export function useLoadChat(chatId: string | undefined) {
  const setMessages = useChatProperty((state) => state.setMessages);
  const setChatId = useActiveChat((state) => state.setChatId);
  const loaded = useRef<string | null>(null);

  useEffect(() => {
    if (!chatId || loaded.current === chatId) return;
    loaded.current = chatId;

    let cancelled = false;

    void fetch(`/api/chats/${chatId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("gone"))))
      .then((data: { chat: { messages: unknown[] } }) => {
        if (cancelled) return;
        setMessages(data.chat.messages as MyUIMessage[]);
        setChatId(chatId);
      })
      .catch(() => {
        if (!cancelled) toast.error("تعذّر فتح هذه المحادثة");
      });

    return () => {
      cancelled = true;
    };
  }, [chatId, setMessages, setChatId]);
}
