"use client";

import type { MyUIMessage } from "@/types/ai";
import { useEffect, useState } from "react";
import { useChatProperty } from "ai-sdk-zustand";
import { MAX_FOLLOW_UPS } from "@/lib/rfeeq/follow-ups";

/**
 * What to ask next, written once from this answer and then kept.
 *
 * Suggestions are a property *of an answer*: the same answer yields the same
 * next questions, so generating them again is a model call that arrives back
 * where it started. They are also rendered under **every** answer in a thread,
 * not just the newest — so reopening a ten-turn conversation used to fire ten
 * requests, every time it was opened.
 *
 * They now live on the message's own metadata, which is saved with the
 * conversation and comes back with it. Two layers guard the call:
 *
 * - `message.metadata.followUps` — durable, survives a reload, and is what
 *   makes a reopened conversation cost nothing.
 * - the module-level `cache` — for the life of this tab, covering the gap
 *   between generating a set and the save that stores it, and the remounts the
 *   thread performs as it scrolls.
 *
 * An empty array is a real answer in both: it means this answer has no useful
 * next step, and asking again would reach the same conclusion.
 */

const cache = new Map<string, string[]>();
const inFlight = new Set<string>();

/** Whether the stored value is a usable set rather than absent or malformed. */
const stored = (message: MyUIMessage): string[] | null => {
  const saved = message.metadata?.followUps;
  return Array.isArray(saved) ? saved : null;
};

export function useFollowUps({
  message,
  question,
  answer,
  complete,
  fallback,
}: {
  /** The answer being suggested from; its metadata is where the set is kept. */
  message: MyUIMessage;
  question: string;
  answer: string;
  /** Only ask once the answer has finished; a partial one suggests badly. */
  complete: boolean;
  fallback: string[];
}) {
  const messageId = message.id;
  const saved = stored(message);
  const [fetched, setFetched] = useState<string[] | null>(null);
  /*
   * The setter alone, never the messages. Subscribing to the message list here
   * would re-render every answer in the thread on every streamed token, and
   * this hook runs once per answer.
   */
  const setMessages = useChatProperty((state) => state.setMessages);

  /*
   * Read during render, not copied into state by an effect. The cache is
   * populated by an earlier mount of the same message, and setting state to
   * mirror it would be a render pass that changes nothing a reader can see.
   */
  const generated = saved ?? fetched ?? cache.get(messageId) ?? null;

  useEffect(() => {
    if (!complete || !answer.trim() || !question.trim()) return;
    // already known — stored with the conversation, or asked in this tab
    if (saved !== null || cache.has(messageId)) return;
    // two mounts of the same message must not both ask
    if (inFlight.has(messageId)) return;
    inFlight.add(messageId);

    let cancelled = false;
    void fetch("/api/rfeeq-followups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, answer }),
    })
      .then((res) => (res.ok ? res.json() : { questions: [] }))
      .then((data: { questions?: string[] }) => {
        const questions = (data.questions ?? []).slice(0, MAX_FOLLOW_UPS);
        cache.set(messageId, questions);
        if (cancelled) return;
        setFetched(questions);

        /*
         * Written onto the message so the conversation's next save carries it.
         * An updater rather than a new array built from a subscribed list: this
         * runs after an await, and the list it closed over may be stale by now.
         */
        setMessages((current) =>
          current.map((item) => {
            if (item.id !== messageId) return item;
            // the type is `… | undefined`, so spreading it needs the fallback
            const previous = (item as MyUIMessage).metadata ?? {};
            return { ...item, metadata: { ...previous, followUps: questions } };
          }),
        );
      })
      .catch(() => {
        // leave the fallback in place
      })
      .finally(() => inFlight.delete(messageId));

    return () => {
      cancelled = true;
    };
  }, [complete, messageId, question, answer, saved, setMessages]);

  // a generated empty list is a decision; null means it has not arrived yet
  return (generated ?? fallback).slice(0, MAX_FOLLOW_UPS);
}
