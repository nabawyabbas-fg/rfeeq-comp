"use client";

import type { RfeeqRouting } from "@/lib/rfeeq/intent";
import type { MyUIMessage } from "@/types/ai";
import { useMemo } from "react";
import { routeQuestion } from "@/lib/rfeeq/intent";
import {
  useChatMessages,
  useChatProperty,
  useChatStatus,
} from "ai-sdk-zustand";

import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@agentset/ui/ai/message-scroller";
import { cn } from "@agentset/ui/cn";

import { Icon } from "../icon";
import { Button } from "../ui/button";
import { Dots, Skeleton, State } from "../ui/feedback";
import { Answer } from "./answer";
import { RfeeqScriptureProvider } from "./answer-body";
import { RfeeqSourcesProvider } from "./sources";

/**
 * What each retrieval tool is doing, in the reader's language.
 *
 * A 15-to-60-second wait deserves more than a spinner. These are the tools the
 * intent router hands out, so the line tracks what is actually happening rather
 * than describing retrieval in general.
 */
const ACTIVITY: Record<string, string> = {
  approved_web_search: "يبحث في المصادر المعتمدة",
  quran_verse: "يُحضر نصّ الآية",
  quran_search: "يبحث في نصّ القرآن",
  surah_info: "يراجع بيانات السورة",
  hadith_search: "يبحث في موسوعة الحديث",
  library_search: "يبحث في موسوعة المحتوى الإسلامي",
  read_sources: "يقرأ النصّ وتوثيقه",
  tafsir_get: "يراجع كلام المفسّرين",
  tafsir_sources: "يستعرض التفاسير المعتمدة",
  nuzool_reason: "يتحقّق من سبب النزول",
  term_get: "يراجع قاموس المصطلحات",
  term_list: "يتصفّح المصطلحات",
  term_categories: "يتصفّح المصطلحات",
};

/** The tool currently in flight, as something to say out loud. */
const activityOf = (message: MyUIMessage | undefined): string | null => {
  if (!message) return null;

  // the last tool part that has not produced output yet is the one running
  for (let i = message.parts.length - 1; i >= 0; i--) {
    const part = message.parts[i];
    if (!part?.type.startsWith("tool-")) continue;
    const state = (part as { state?: string }).state;
    if (state === "output-available" || state === "output-error") continue;
    return ACTIVITY[part.type.slice("tool-".length)] ?? null;
  }
  return null;
};

/** Whether an assistant turn has written anything the reader can see yet. */
const hasText = (message: MyUIMessage | undefined) =>
  Boolean(
    message?.parts.some((part) => part.type === "text" && part.text.trim()),
  );

/** First text part of a message, which is the question or the answer. */
const textOf = (message: MyUIMessage) => {
  for (const part of message.parts) {
    if (part.type === "text" && part.text) return part.text;
  }
  return "";
};

/**
 * The conversation.
 *
 * Built on the existing message scroller rather than a plain scroll container:
 * sending pins the question near the top of the viewport and the answer streams
 * into the space below it, without the view chasing the stream. That behaviour
 * was deliberate work and is worth more here than on the playground — a long
 * Arabic answer with a source panel open is exactly where a self-scrolling view
 * loses the reader's place.
 */
export function Thread({
  onFollowUp,
  onShare,
}: {
  onFollowUp: (question: string) => void;
  onShare: (message: MyUIMessage) => void;
}) {
  const messages = useChatMessages<MyUIMessage>();
  const status = useChatStatus();
  const last = messages.at(-1);
  const lastMessageId = last?.id;

  /*
   * Still retrieving — show the searching state.
   *
   * Not `status === "submitted"`, which is what this used to test. In an
   * agentic run the first thing the stream emits is a *tool call*, so status
   * flips to "streaming" within a second or two while the search itself runs
   * for another fifteen to sixty. The reader was left looking at nothing for
   * all of it. What matters is whether the answer has produced any text yet.
   */
  const retrieving =
    status === "submitted" ||
    (status === "streaming" && last?.role === "assistant" && !hasText(last));

  /**
   * Each answer classified by the question it answers.
   *
   * Keyed on the assistant message, taken from the user turn before it, so a
   * restored conversation is classified the same way a live one is — the
   * routing is derived from the question text, which is persisted, rather than
   * stored alongside it. The question itself travels with it, because the
   * follow-up suggestions are written against the exchange, not the answer
   * alone.
   */
  const turns = useMemo(() => {
    const map = new Map<string, { question: string; routing: RfeeqRouting }>();
    let pending: string | null = null;

    for (const message of messages) {
      if (message.role === "user") {
        pending = textOf(message);
        continue;
      }
      if (message.role === "assistant" && pending) {
        map.set(message.id, {
          question: pending,
          routing: routeQuestion(pending),
        });
      }
    }
    return map;
  }, [messages]);

  return (
    <MessageScrollerProvider
      defaultScrollPosition="last-anchor"
      scrollPreviousItemPeek={0}
    >
      <MessageScroller className="min-w-0 flex-1">
        <MessageScrollerViewport>
          <MessageScrollerContent className="mx-auto w-full max-w-180 gap-8 px-5 pt-6 pb-4">
            {messages.map((message) => {
              const streaming =
                status === "streaming" && message.id === lastMessageId;

              return (
                <MessageScrollerItem
                  key={message.id}
                  messageId={message.id}
                  scrollAnchor={message.role === "user"}
                >
                  {message.role === "user" ? (
                    <Question text={textOf(message)} />
                  ) : message.id === lastMessageId && retrieving ? (
                    /* an answer with no text yet is not an empty answer, it is
                       a search in progress — show that rather than a blank */
                    <Searching activity={activityOf(message)} />
                  ) : (
                    /* One provider per turn: citation numbers are scoped to
                       the answer that emitted them, and so is the panel. */
                    <RfeeqScriptureProvider>
                      <RfeeqSourcesProvider message={message}>
                        <Answer
                          message={message}
                          text={textOf(message)}
                          question={turns.get(message.id)?.question ?? ""}
                          isLoading={streaming}
                          routing={turns.get(message.id)?.routing ?? null}
                          onFollowUp={onFollowUp}
                          onShare={() => onShare(message)}
                        />
                      </RfeeqSourcesProvider>
                    </RfeeqScriptureProvider>
                  )}

                  {/* Inside the item, not a sibling: the scroller tracks
                      Content's direct children, and swapping a sibling
                      placeholder for the first assistant item in one commit
                      trips its replaced-anchor fallback. */}
                  {message.role === "user" &&
                  message.id === lastMessageId &&
                  retrieving ? (
                    <div className="mt-6">
                      <Searching activity={null} />
                    </div>
                  ) : null}

                  {message.id === lastMessageId && status === "error" ? (
                    <div className="mt-6">
                      <AnswerError />
                    </div>
                  ) : null}
                </MessageScrollerItem>
              );
            })}
          </MessageScrollerContent>
        </MessageScrollerViewport>

        <MessageScrollerButton
          className="border-rf-line-strong bg-rf-surface text-rf-text hover:bg-rf-surface-2 rounded-full"
          variant="outline"
          size="icon"
        />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}

/**
 * The reader's question.
 *
 * A tinted bubble, aligned to the start of the column and capped well short of
 * the measure — unlike the answer, which runs the full width. The asymmetry is
 * what makes a long thread scannable: questions are short and indented,
 * answers are long and flush.
 */
function Question({ text }: { text: string }) {
  return (
    <div
      className={cn(
        "rounded-rf-lg bg-rf-surface-2 max-w-[min(88%,560px)] justify-self-start px-4 py-3",
        "font-rf-ui text-rf-text text-[15px]/[1.8]",
      )}
      dir="auto"
    >
      {text}
    </div>
  );
}

/**
 * While the search runs.
 *
 * Says what is happening rather than spinning: the agentic run searches the
 * corpus before it writes anything, and a reader who is told so waits
 * differently from one watching an unexplained loader.
 */
function Searching({ activity }: { activity: string | null }) {
  return (
    <div aria-busy="true" className="grid grid-cols-1 gap-3">
      <div className="mb-1 flex items-center gap-3">
        <Dots />
        <span
          role="status"
          // polite, so a screen reader hears each step rather than only the
          // first — the line changes as the run moves between sources
          aria-live="polite"
          className="font-rf-ui text-rf-text-3 text-[13px]/[1.6]"
        >
          {activity ?? "يجري البحث في المصادر"}
        </span>
      </div>
      <Skeleton width="92%" />
      <Skeleton width="100%" />
      <Skeleton width="64%" />
    </div>
  );
}

/** A run that failed. Offers the one action that can help. */
function AnswerError() {
  return (
    <div className="rounded-rf-lg border-rf-line bg-rf-surface border-[1.5px]">
      <State
        tone="error"
        icon="alert"
        title="تعذّر إكمال الإجابة"
        description="حدث خلل أثناء الوصول إلى المصادر. حاول مرة أخرى."
        className="py-5"
        action={<RetryButton />}
      />
    </div>
  );
}

function RetryButton() {
  const status = useChatStatus();
  // regenerate() re-answers the last user message, which is exactly what
  // failed. Read from the store rather than passed down, so the error state
  // does not have to be threaded through the thread.
  const regenerate = useChatProperty((state) => state.regenerate);

  return (
    <Button
      variant="tonal"
      size="sm"
      disabled={status === "streaming" || status === "submitted"}
      onClick={() => void regenerate()}
    >
      <Icon name="refresh" size="sm" />
      إعادة المحاولة
    </Button>
  );
}
