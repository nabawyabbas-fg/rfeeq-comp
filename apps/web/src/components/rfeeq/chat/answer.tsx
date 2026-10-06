"use client";

import type { RfeeqExclusion, RfeeqRouting } from "@/lib/rfeeq/intent";
import type { MyUIMessage } from "@/types/ai";
import { useState } from "react";
import { logEvent } from "@/lib/analytics";
import { extractTextFromParts } from "@/lib/string-utils";
import { toast } from "sonner";
import { useCopyToClipboard } from "usehooks-ts";

import { cn } from "@agentset/ui/cn";

import type { HadithDetails } from "./hadith-panel";
import { hadithDetailsOf } from "./hadith-panel";
import { normaliseArabic } from "@/lib/verify-quotes";

import { Icon } from "../icon";
import { Chip } from "../ui/tag";
import { AnswerBody } from "./answer-body";
import { FeedbackDialog } from "./feedback-dialog";
import { useRfeeqSources } from "./sources";
import { useFollowUps } from "./use-follow-ups";

/**
 * The fallback suggestions, by template.
 *
 * Shown while the generated ones are still being written, and kept if
 * generation fails. Generic by nature — «هذه الآية» rather than naming it —
 * which is exactly why they are no longer the whole story: a follow-up is only
 * worth offering if it is the next thing *this* answer leaves open.
 */
const FOLLOW_UPS: Record<string, string[]> = {
  aya: ["اشرح هذه الآية", "ما فوائد هذه الآية؟"],
  tafsir: ["ما سبب نزول هذه الآية؟", "ما فوائد هذه الآية؟"],
  "hadith-card": ["اشرح هذا الحديث", "ما الصحيح في هذا المعنى؟"],
  "hadith-explain": [
    "من راوي الحديث؟",
    "أحاديث في المعنى نفسه",
    "ما الصحيح في هذا المعنى؟",
  ],
  fatwa: ["ما الدليل؟", "ما اختلاف العلماء في هذه المسألة؟"],
  general: ["وضّح أكثر", "ما الدليل؟"],
};

/**
 * What the reader is told when a scope exclusion applies.
 *
 * One line per exclusion, because the brief excludes four things and a reader
 * who asked about a named group is not helped by being told their *own case*
 * cannot be ruled on. Each one names what will not be done and what follows
 * instead, in that order — the answer still appears in full, since the brief
 * says to give the general information and withhold only the judgement.
 */
const EXCLUSION_NOTICE: Record<RfeeqExclusion, string> = {
  "personal-case":
    "سؤالك يتعلّق بحالة خاصة، ولا يصدر رفيق حكمًا في الحالات الخاصة. ما يلي معلومات عامة من المصادر؛ وللحكم في حالتك اسأل جهة إفتاء مؤهلة.",
  "persons-groups":
    "سؤالك يطلب حكمًا على شخص أو جماعة بعينها، ولا يحكم رفيق على الأشخاص ولا على الجماعات. ما يلي الأصل العلمي العام في المسألة بضوابطه من المصادر المعتمدة.",
  "private-dispute":
    "سؤالك يتعلّق بنزاع خاص، ولا يفصل رفيق بين أطراف نزاع. ما يلي معلومات عامة من المصادر؛ وللفصل في نزاعك راجع جهة قضاء أو إصلاح مؤهلة.",
  hypothetical:
    "سؤالك مبنيّ على واقعة مفترضة، ولا يبني رفيق حكمًا على فرض. ما يلي الأصل العام وما يتوقف عليه الحكم من المصادر المعتمدة.",
};

/**
 * The notice for an out-of-scope question.
 *
 * It sits *above* the answer, not below it: what the reader most needs to know
 * before reading on is that what follows is general information rather than a
 * judgement on what they asked about.
 */
function ExclusionNotice({ exclusion }: { exclusion: RfeeqExclusion }) {
  return (
    <div
      role="note"
      className={cn(
        "rounded-rf-md border-rf-line-strong mb-5 flex items-start gap-3 border-[1.5px]",
        "bg-rf-surface-2 font-rf-ui text-rf-text px-4 py-3 text-sm/[1.7] font-medium",
      )}
    >
      <Icon name="info" className="text-rf-accent mt-1 shrink-0" />
      <span>{EXCLUSION_NOTICE[exclusion]}</span>
    </div>
  );
}

/**
 * One assistant turn, in the approved answer frame.
 *
 * Body, then the sources link, then the action bar, then the follow-ups. No
 * badge row and no dividers — v1.3 removed the badges, and the presentation
 * relies on headings over body text rather than on boxes. What the reader sees
 * of the classification is therefore the things it changes: the referral notice
 * above, the relay note below, and which follow-ups are offered.
 */
export function Answer({
  message,
  text,
  question,
  isLoading,
  routing,
  onFollowUp,
  onShare,
}: {
  message: MyUIMessage;
  text: string;
  /** The question this answers; the suggestions are written against both. */
  question: string;
  isLoading: boolean;
  /** Null on a restored conversation whose question was not re-classified. */
  routing: RfeeqRouting | null;
  onFollowUp: (question: string) => void;
  onShare: () => void;
}) {
  const panel = useRfeeqSources();
  const [vote, setVote] = useState<1 | -1 | 0>(0);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [, copy] = useCopyToClipboard();

  const template = routing?.template ?? "general";
  const sourceCount = panel?.sources.length ?? 0;

  /*
   * The hadith this answer is about, if it is about one. Read from the
   * retrieved chunks for the same reason the verse is: تفاصيل الحديث is built
   * from الدرر السنية's rulings, and those arrive as data on the chunk, never
   * as something the model wrote.
   *
   * Not gated on the template. A fiqh or ʿaqīda answer can turn on a hadith and
   * quote it, and the rulings on that matn are exactly as worth reading there —
   * what decides the link is whether a hadith was actually retrieved.
   */
  /*
   * The link at the foot stands for *the* hadith, so it appears only when there
   * is one.
   *
   * It used to take the first of however many were retrieved. That was already
   * arbitrary and is now redundant: every quoted hadith in the answer opens its
   * own details where it is quoted, so with four reports on screen a single
   * link naming none of them is worse than no link at all.
   *
   * Counted by matn, because one report can arrive as several chunks — موسوعة
   * الحديث's record and the Dorar pages carrying rulings on it are the same
   * hadith from three sources.
   */
  const hadith = (() => {
    const found = new Map<string, HadithDetails>();
    for (const source of panel?.sources ?? []) {
      for (const chunk of source.chunks) {
        const details = hadithDetailsOf(chunk);
        if (details) found.set(normaliseArabic(details.matn), details);
      }
    }
    return found.size === 1 ? [...found.values()][0]! : null;
  })();

  const followUps = useFollowUps({
    message,
    question,
    answer: text,
    complete: !isLoading,
    fallback: FOLLOW_UPS[template] ?? FOLLOW_UPS.general!,
  });

  const handleCopy = async () => {
    const body = extractTextFromParts(message.parts);
    if (!body) {
      toast.error("لا يوجد نص للنسخ");
      return;
    }
    await copy(body);
    toast.success("نُسخت الإجابة");
  };

  return (
    <div className="block" data-template={template}>
      {routing?.exclusion ? (
        <ExclusionNotice exclusion={routing.exclusion} />
      ) : null}

      <AnswerBody
        message={message}
        isLoading={isLoading}
        template={routing?.template ?? null}
        question={question}
        routing={routing}
      >
        {text}
      </AnswerBody>

      {!isLoading ? (
        <>
          {/*
            * «تفاصيل الحديث» — الراوي وأحكام المحدّثين من الموسوعة الحديثية.
            *
            * Last before the sources, where the answer's exits live: the body
            * is the answer, and what sits under it are the ways out of it. The
            * matn opens the same pane, but a reader who has finished reading
            * ends up here rather than back at the quote.
            */}
          {hadith ? (
            <button
              type="button"
              onClick={() => panel?.openHadith(hadith)}
              className={cn(
                "mt-6 flex w-fit cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0",
                "font-rf-ui text-rf-accent min-h-9 text-[15px] font-medium",
                "hover:underline hover:underline-offset-[5px]",
                "focus-visible:outline-rf-focus outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2",
              )}
            >
              تفاصيل الحديث
              <Icon name="chev" size="sm" mirror />
            </button>
          ) : null}

          {sourceCount > 0 ? (
            <button
              type="button"
              onClick={() => panel?.openList()}
              className={cn(
                "mt-6 flex w-fit cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0",
                "font-rf-ui text-rf-accent min-h-9 text-[15px] font-medium",
                "hover:underline hover:underline-offset-[5px]",
                "focus-visible:outline-rf-focus outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2",
              )}
            >
              المصادر ({sourceCount})
              <Icon name="chev" size="sm" mirror />
            </button>
          ) : null}

          <div className="-ms-1.5 mt-2.5 flex items-center">
            <ActionButton
              label="إجابة مفيدة"
              icon="up"
              pressed={vote === 1}
              onClick={() => {
                const next = vote === 1 ? 0 : 1;
                setVote(next);
                if (next === 1) {
                  logEvent("rfeeq_answer_feedback", {
                    messageId: message.id,
                    vote: "up",
                  });
                }
              }}
            />
            <ActionButton
              label="إجابة غير مفيدة"
              icon="down"
              pressed={vote === -1}
              onClick={() => {
                // the dialog records the vote, so it is not set here: a
                // dismissed dialog should leave the answer unmarked
                if (vote === -1) {
                  setVote(0);
                  return;
                }
                setFeedbackOpen(true);
              }}
            />
            <ActionButton
              label="نسخ الإجابة"
              icon="copy"
              onClick={() => void handleCopy()}
            />
            <ActionButton label="مشاركة" icon="share" onClick={onShare} />
          </div>

          <div
            aria-label="أسئلة للمتابعة"
            className="mt-3.5 flex flex-col items-start"
          >
            {followUps.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => onFollowUp(question)}
                className={cn(
                  "inline-flex min-h-9 cursor-pointer items-center gap-2 border-0 bg-transparent p-0",
                  "font-rf-ui text-rf-text hover:text-rf-accent text-start text-[15px]",
                  "focus-visible:outline-rf-focus outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2",
                )}
              >
                {question}
                <Icon
                  name="arrowdiag"
                  size="sm"
                  mirror
                  className="text-rf-accent"
                />
              </button>
            ))}
          </div>
        </>
      ) : null}

      <FeedbackDialog
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        messageId={message.id}
        onSubmitted={() => setVote(-1)}
      />
    </div>
  );
}

function ActionButton({
  label,
  icon,
  pressed,
  onClick,
}: {
  label: string;
  icon: "up" | "down" | "copy" | "share";
  pressed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "grid h-9 min-h-9 w-8 min-w-8 cursor-pointer place-items-center rounded-lg border-0 bg-transparent",
        "text-rf-text-2 hover:bg-rf-surface-2 hover:text-rf-text",
        "aria-pressed:bg-rf-accent-soft aria-pressed:text-rf-accent",
        "focus-visible:outline-rf-focus outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2",
      )}
    >
      <Icon name={icon} />
    </button>
  );
}

/** The suggested question chips offered under an empty thread. */
export function FollowUpChips({
  questions,
  onPick,
}: {
  questions: string[];
  onPick: (question: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {questions.map((question) => (
        <Chip key={question} onClick={() => onPick(question)}>
          {question}
        </Chip>
      ))}
    </div>
  );
}
