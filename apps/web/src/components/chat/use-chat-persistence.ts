"use client";

import type { MyUIMessage } from "@/types/ai";
import { useEffect, useRef } from "react";
import { useChatProperty } from "ai-sdk-zustand";

import { useActiveChat } from "./active-chat.store";

/**
 * Persists the conversation after each completed turn.
 *
 * Agentset has no chat storage of its own — conversations live in React state
 * and are lost on reload — so this writes them to the `chat` tables through
 * /api/chats. Saving on completion rather than per token keeps it to one write
 * per turn, and the whole message list is sent because a turn can be edited or
 * regenerated, which rewrites history rather than appending to it.
 */
/** Long enough for the finish event's metadata to land, short enough that a
 *  closed tab rarely beats it. */
const SAVE_DEBOUNCE_MS = 500;

/**
 * What counts as a state already written.
 *
 * The metrics ride on the stream's finish event and can land after status flips
 * to "ready", so the flag is part of the signature: a turn saved without its
 * cost breakdown must still be re-saved once the breakdown arrives.
 */
const signatureOf = (messages: MyUIMessage[], status: string) => {
  const last = messages[messages.length - 1];
  const hasMetrics = last?.metadata?.metrics ? "m" : "-";
  /*
   * Follow-ups are counted across the whole list, not read off the last
   * message. They are generated per answer and rendered under every one, so an
   * answer part-way up the thread can acquire a set — and a signature that
   * only watched the newest turn would never save it.
   */
  const followUps = messages.reduce(
    (count, message) => count + (message.metadata?.followUps ? 1 : 0),
    0,
  );
  return `${messages.length}:${last?.id}:${status}:${hasMetrics}:f${followUps}`;
};

export const useChatPersistence = ({
  namespaceId,
  hostingId,
  enabled = true,
}: {
  /** The corpus searched, or undefined on a surface that searches none. */
  namespaceId?: string;
  hostingId?: string;
  enabled?: boolean;
}) => {
  const messages = useChatProperty((s) => s.messages) as MyUIMessage[];
  const status = useChatProperty((s) => s.status);
  const chatId = useActiveChat((s) => s.chatId);
  const setChatId = useActiveChat((s) => s.setChatId);

  const chatIdRef = useRef<string | null>(chatId);
  const lastSaved = useRef<string>("");
  // Saves are serialised through this chain. Two turns finishing before the
  // first POST returns would otherwise both see a null chatIdRef and each
  // create a separate chat, splitting one conversation across two records.
  const inFlight = useRef<Promise<void>>(Promise.resolve());

  /*
   * Switching conversations re-points the de-dupe key — it does not clear it.
   *
   * Clearing it was the bug behind a history list that sorted by *last opened*
   * rather than last changed. Loading a conversation sets its messages, whose
   * last is an assistant turn, with status already "ready" — which is exactly
   * the shape this hook saves. So merely opening an old conversation POSTed the
   * whole thing back, replacing every message row and bumping `updatedAt`, and
   * the rail's `orderBy: { updatedAt: "desc" }` floated it to the top. Reading
   * is not writing.
   *
   * Recording the signature instead of clearing it still answers what the
   * clearing was for: the loaded state is marked saved because the server is
   * where it just came from, and the next turn changes the signature and saves
   * normally. The ref guard keeps this to actual switches — the effect watches
   * `messages` only so it can read them at the moment one happens.
   */
  const lastSwitch = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (lastSwitch.current === chatId) return;
    lastSwitch.current = chatId;
    chatIdRef.current = chatId;
    // a new conversation has nothing stored yet, so nothing is already saved
    lastSaved.current = chatId ? signatureOf(messages, status) : "";
  }, [chatId, messages, status]);

  useEffect(() => {
    if (!enabled || messages.length === 0) return;
    // "error" is saved too: a run that fails still contains the user's question,
    // and dropping it loses the turn entirely
    if (status !== "ready" && status !== "error") return;

    const last = messages[messages.length - 1];
    // on a clean finish an assistant turn must have landed, which skips the
    // state right after submit; a failed run is saved as-is
    if (status === "ready" && last?.role !== "assistant") return;

    // The metrics ride on the stream's finish event, which can land a beat
    // after status flips to "ready". Saving immediately races the metadata and
    // persists the turn without its cost/latency breakdown — it was missing
    // from half the recorded turns before this. Waiting a moment lets the
    // metadata arrive: if it does, this effect re-runs, the cleanup below
    // cancels the pending save, and the turn is written once, complete. The
    // signature still carries the metrics flag, so an arrival later than the
    // debounce still triggers a corrected re-save.
    const signature = signatureOf(messages, status);
    if (lastSaved.current === signature) return;

    const timer = setTimeout(() => {
      lastSaved.current = signature;
      const body = {
        ...(chatIdRef.current ? { chatId: chatIdRef.current } : {}),
        // omitted, not null: the column is nullable and the surface simply has
        // no corpus to name
        ...(namespaceId ? { namespaceId } : {}),
        ...(hostingId ? { hostingId } : {}),
        messages: messages.map((message) => ({
          role: message.role,
          parts: message.parts,
          // the cost/latency breakdown lives here; without it a reloaded
          // conversation loses the numbers for every past turn
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
          // a rejected save must clear the de-dupe key too, otherwise the
          // turn stays marked as saved and is never retried
          if (!res.ok) {
            lastSaved.current = "";
            return;
          }
          const { chat } = (await res.json()) as { chat: { id: string } };
          if (!chatIdRef.current) {
            chatIdRef.current = chat.id;
            setChatId(chat.id);
          }
        } catch {
          // history is best-effort: a failed save must never break the chat
          lastSaved.current = "";
        }
      });
    }, SAVE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [enabled, status, messages, namespaceId, hostingId, setChatId]);

  return chatIdRef;
};
