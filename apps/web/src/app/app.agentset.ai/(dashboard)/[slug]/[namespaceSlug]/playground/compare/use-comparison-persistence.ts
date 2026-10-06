"use client";

import type { MyUIMessage } from "@/types/ai";
import { useEffect, useRef } from "react";

type Mode = "PRIMARY" | "SECONDARY" | "TERTIARY" | "BOTH";

/**
 * Saves one pane of a comparison after each completed turn.
 *
 * Deliberately mirrors `useChatPersistence` rather than reusing it: that hook
 * reads the single global chat store, and a comparison has several
 * conversations on screen at once. Each pane is written as an ordinary chat carrying the
 * shared `comparisonId`, so the whole run reloads with its citations and
 * cost breakdowns intact.
 */
const SAVE_DEBOUNCE_MS = 500;

export const usePanePersistence = ({
  namespaceId,
  comparisonId,
  retrievalMode,
  messages,
  status,
  restoredChatId,
}: {
  namespaceId: string;
  comparisonId: string | null;
  retrievalMode: Mode;
  messages: MyUIMessage[];
  status: "submitted" | "streaming" | "ready" | "error";
  /**
   * The record this pane was restored from, if the run came out of history.
   * Without it a follow-up turn writes a second row for the same pane, and the
   * next restore then has to guess which of them to show.
   */
  restoredChatId?: string | null;
}) => {
  const chatIdRef = useRef<string | null>(null);
  const lastSaved = useRef<string>("");
  // serialised: two turns finishing before the first POST returns would each
  // see a null chatIdRef and create a second chat for the same pane
  const inFlight = useRef<Promise<void>>(Promise.resolve());
  const lastComparison = useRef<string | null>(comparisonId);

  // A new run starts a new record; a restored one continues the record it came
  // from. Both are comparison-id changes, so the restored id is what tells them
  // apart — resetting unconditionally is what produced duplicate panes.
  useEffect(() => {
    if (lastComparison.current !== comparisonId) {
      lastComparison.current = comparisonId;
      chatIdRef.current = restoredChatId ?? null;
      lastSaved.current = "";
    }
  }, [comparisonId, restoredChatId]);

  useEffect(() => {
    if (!comparisonId || messages.length === 0) return;
    if (status !== "ready" && status !== "error") return;

    const last = messages[messages.length - 1];
    if (status === "ready" && last?.role !== "assistant") return;

    // metrics ride the finish event and can land after status flips; the flag
    // keeps a late arrival from being treated as already saved
    const hasMetrics = last?.metadata?.metrics ? "m" : "-";
    const signature = `${comparisonId}:${messages.length}:${last?.id}:${status}:${hasMetrics}`;
    if (lastSaved.current === signature) return;

    const timer = setTimeout(() => {
      lastSaved.current = signature;
      const body = {
        ...(chatIdRef.current ? { chatId: chatIdRef.current } : {}),
        namespaceId,
        comparisonId,
        retrievalMode,
        messages: messages.map((message) => ({
          role: message.role,
          parts: message.parts,
          metadata: message.metadata ?? null,
        })),
      };

      inFlight.current = inFlight.current.then(async () => {
        try {
          const res = await fetch("/api/chats", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (!res.ok) {
            lastSaved.current = "";
            return;
          }
          const { chat } = (await res.json()) as { chat: { id: string } };
          chatIdRef.current ??= chat.id;
        } catch {
          // history is best-effort; a failed save must never break the run
          lastSaved.current = "";
        }
      });
    }, SAVE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [comparisonId, namespaceId, retrievalMode, messages, status]);
};
