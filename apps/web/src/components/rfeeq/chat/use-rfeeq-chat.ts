"use client";

import type { MyUIMessage } from "@/types/ai";
import { GUEST_QUESTION_LIMIT } from "@/contexts/rfeeq-context";
import { DefaultChatTransport } from "ai";
import { useChat } from "ai-sdk-zustand";
import { toast } from "sonner";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { usePreferences } from "../preferences";

/**
 * The conversation.
 *
 * `/api/rfeeq-chat` — its own endpoint, not the hosting one. Retrieval here is
 * live from the challenge's approved platforms, so there is no namespace to
 * name and no `Hosting` row to configure: the question's intent chooses which
 * approved sources may answer it, server-side.
 */
export function useRfeeqChat() {
  return useChat<MyUIMessage>({
    transport: new DefaultChatTransport({
      api: "/api/rfeeq-chat",
      prepareSendMessagesRequest({ messages, body }) {
        // Read at send time rather than captured in the closure, so changing
        // the preference mid-conversation applies to the next question
        // instead of to the next page load.
        return {
          body: {
            messages,
            ...body,
            answerDepth: usePreferences.getState().answerDepth,
            expertise: usePreferences.getState().expertise,
          },
        };
      },
    }),
    experimental_throttle: 100,
    onError: () => {
      toast.error("تعذّر إكمال الإجابة. حاول مرة أخرى.");
    },
  });
}

/** Today, as a date key. Local time, because the limit reads as a calendar day. */
const dayKey = () => {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};

interface GuestQuotaState {
  day: string;
  count: number;
  consume: () => void;
}

/**
 * How many questions a guest has asked today.
 *
 * Client-side, and deliberately so. This is not a security control — the
 * endpoint's per-IP rate limit is what protects retrieval — it is the prompt to
 * create an account, placed where the design chose: after three questions, when
 * the reader has seen what the system does and has a conversation worth
 * keeping.
 *
 * Stored against a date so it resets at midnight, matching what the wall says
 * («وقد استخدمتَها كلها … أو عُد غدًا»). A reader who clears their storage gets
 * three more, which costs nothing worth defending.
 */
const useGuestQuotaStore = create<GuestQuotaState>()(
  persist(
    (set) => ({
      day: dayKey(),
      count: 0,
      consume: () =>
        set((state) => {
          // the stored day having rolled over is the reset; checked on write
          // rather than on a timer, since nothing happens until they ask again
          const today = dayKey();
          return state.day === today
            ? { count: state.count + 1 }
            : { day: today, count: 1 };
        }),
    }),
    { name: "rfeeq:guest-questions" },
  ),
);

export function useGuestQuota(enabled: boolean) {
  const day = useGuestQuotaStore((state) => state.day);
  const count = useGuestQuotaStore((state) => state.count);
  const consume = useGuestQuotaStore((state) => state.consume);

  // a stored count from an earlier day is spent, not carried
  const used = day === dayKey() ? count : 0;

  return {
    used,
    remaining: Math.max(0, GUEST_QUESTION_LIMIT - used),
    exhausted: enabled && used >= GUEST_QUESTION_LIMIT,
    consume,
  };
}
