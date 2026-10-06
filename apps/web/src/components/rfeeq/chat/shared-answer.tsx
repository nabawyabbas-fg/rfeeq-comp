"use client";

import type { MyUIMessage } from "@/types/ai";
import Link from "next/link";
import { ConversationMessagesProvider } from "@/components/chat/conversation-messages";

import { cn } from "@agentset/ui/cn";

import { Icon } from "../icon";
import { RfeeqLogo } from "../logo";
import { routeQuestion } from "@/lib/rfeeq/intent";

import { AnswerBody, RfeeqScriptureProvider } from "./answer-body";
import { RfeeqSourcesProvider, useRfeeqSources } from "./sources";

/** The one call to action on this page, used twice. */
const CTA = cn(
  "rounded-rf-sm inline-flex items-center justify-center px-5",
  "bg-rf-accent font-rf-ui text-rf-on-accent text-[15px] font-semibold",
  "hover:bg-rf-accent-strong",
);

/** First text part of a message. */
const textOf = (message: MyUIMessage) => {
  for (const part of message.parts) {
    if (part.type === "text" && part.text) return part.text;
  }
  return "";
};

/**
 * A shared conversation, read-only.
 *
 * Deliberately not the chat with its controls removed. A reader arriving on a
 * link has no conversation of their own, no history and no account, so the
 * frame is a page rather than an app: a header, the exchange, and an invitation
 * to ask their own question.
 *
 * The sources are listed in full under each answer rather than hidden behind
 * the panel, because the point of sharing is to hand someone the evidence as
 * well as the conclusion — and someone who has not used Rfeeq before will not
 * know a numbered marker opens anything.
 */
export function SharedAnswer({ messages }: { messages: MyUIMessage[] }) {
  return (
    <div className="bg-rf-bg flex h-dvh flex-col overflow-hidden">
      <header className="border-rf-line bg-rf-surface flex min-h-16 shrink-0 items-center gap-3 border-b px-5">
        <RfeeqLogo className="w-[70px]" />
        <Link href="/" className={cn(CTA, "ms-auto min-h-8 px-3 text-[13px]")}>
          اسأل رفيق
        </Link>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-6 pb-10">
        <div className="mx-auto grid w-full max-w-180 gap-8">
          <p className="font-rf-ui text-rf-text-2 flex items-center justify-center gap-2 text-[13px]/[1.6] font-medium">
            <Icon name="info" size="sm" />
            <span>إجابة مشاركة للقراءة فقط</span>
          </p>

          {/* Citations and quote verification resolve against this list rather
              than the global store: there is no live chat on this page. */}
          <ConversationMessagesProvider value={messages}>
            {messages.map((message, index) =>
              message.role === "user" ? (
                <div
                  key={message.id}
                  dir="auto"
                  className={cn(
                    "rounded-rf-lg bg-rf-surface-2 max-w-[min(88%,560px)] justify-self-start px-4 py-3",
                    "font-rf-ui text-rf-text text-[15px]/[1.8]",
                  )}
                >
                  {textOf(message)}
                </div>
              ) : (
                <RfeeqScriptureProvider key={message.id}>
                  <RfeeqSourcesProvider message={message}>
                    <SharedTurn
                      message={message}
                      question={questionBefore(messages, index)}
                    />
                  </RfeeqSourcesProvider>
                </RfeeqScriptureProvider>
              ),
            )}
          </ConversationMessagesProvider>

          <div className="rounded-rf-lg border-rf-accent bg-rf-accent-soft grid justify-items-center gap-3 border-[1.5px] p-5 text-center">
            <h3 className="font-rf-ui text-rf-h3 text-rf-text font-semibold">
              لديك سؤال؟
            </h3>
            <p className="font-rf-ui text-rf-body-sm text-rf-text-2">
              اسأل رفيق واحصل على إجابة موثّقة بمصادرها.
            </p>
            <Link href="/" className={cn(CTA, "min-h-10")}>
              اسأل رفيق
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The question an answer answers: the nearest user turn above it. */
const questionBefore = (messages: MyUIMessage[], index: number) => {
  for (let i = index - 1; i >= 0; i--) {
    const message = messages[i];
    if (message?.role === "user") return textOf(message);
  }
  return "";
};

/**
 * One shared answer.
 *
 * The question is re-classified here rather than stored with the share, so a
 * shared answer keeps the sections it was written in. Without it the markers
 * would be dropped by the sanitiser and the answer would read as one
 * undifferentiated run of prose — the same text, with its structure quietly
 * removed, which is the worst of the available outcomes for a link someone
 * sent to someone else.
 */
function SharedTurn({
  message,
  question,
}: {
  message: MyUIMessage;
  question: string;
}) {
  const routing = question ? routeQuestion(question) : null;

  return (
    <div>
      <AnswerBody
        message={message}
        template={routing?.template ?? null}
        question={question}
        routing={routing}
      >
        {textOf(message)}
      </AnswerBody>
      <SourceList />
    </div>
  );
}

/** The numbered sources, spelled out rather than behind the panel. */
function SourceList() {
  const panel = useRfeeqSources();
  if (!panel || panel.sources.length === 0) return null;

  return (
    <div className="mt-7 grid grid-cols-1 gap-1">
      <div className="font-rf-ui text-rf-text text-[15px]/[1.6] font-semibold">
        المصادر
      </div>
      <ol className="m-0 grid list-none gap-0 p-0">
        {panel.sources.map((source, index) => (
          <li key={source.documentId}>
            <button
              type="button"
              onClick={() => panel.openSource(source.documentId)}
              className={cn(
                "rounded-rf-sm flex min-h-9 w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-2 py-0.5",
                "hover:bg-rf-accent-soft text-start",
              )}
            >
              <span className="bg-rf-accent font-rf-ui text-rf-on-accent h-5 min-w-5 shrink-0 rounded-full text-center text-[11px]/5 font-semibold">
                {index + 1}
              </span>
              <span className="min-w-0 truncate">
                <b className="font-rf-ui text-rf-text text-sm/[1.6] font-semibold">
                  {source.title}
                </b>
                <small className="font-rf-ui text-rf-text-2 ms-1.5 text-[13px]/[1.6]">
                  {source.corpus}
                </small>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Shown when a link has been revoked, or never existed. */
export function SharedAnswerGone() {
  return (
    <div className="bg-rf-bg flex h-dvh flex-col items-center justify-center gap-3 px-5 text-center">
      <div className="bg-rf-danger-soft text-rf-danger grid size-14 place-items-center rounded-full">
        <Icon name="alert" size="lg" />
      </div>
      <h1 className="font-rf-ui text-rf-h3 text-rf-text font-semibold">
        هذا الرابط غير متاح
      </h1>
      <p className="font-rf-ui text-rf-body-sm text-rf-text-2 max-w-[36ch]">
        قد تكون المحادثة حُذفت أو أوقف صاحبها مشاركتها.
      </p>
      <Link href="/" className={cn(CTA, "mt-2 min-h-10")}>
        اسأل رفيق
      </Link>
    </div>
  );
}
