"use client";

import { useState } from "react";
import { logEvent } from "@/lib/analytics";
import { toast } from "sonner";

import { cn } from "@agentset/ui/cn";

import { Button } from "../ui/button";
import { ErrorMessage, Field, Textarea } from "../ui/field";
import { Modal } from "../ui/modal";

/**
 * Why an answer was marked unhelpful.
 *
 * The first two reasons are the ones that matter most here and neither is a
 * generic "bad answer": a wrong source and a wrong hadith grading are the two
 * failures the brief's criteria 1 and 2 are written against, and they need to be
 * separable in the data if the corpus work is to act on them.
 */
const REASONS = [
  { value: "source", label: "المصدر خاطئ" },
  { value: "grade", label: "درجة الحديث خاطئة" },
  { value: "content", label: "المحتوى غير دقيق" },
  { value: "unclear", label: "الإجابة غير واضحة" },
  { value: "other", label: "سبب آخر" },
] as const;

export function FeedbackDialog({
  open,
  onOpenChange,
  messageId,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageId: string;
  /** Called once the vote is recorded, so the answer can show it as pressed. */
  onSubmitted: () => void;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [detail, setDetail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setReason(null);
    setDetail("");
    setError(null);
    onOpenChange(false);
  };

  const record = (withReason: string | null) => {
    logEvent("rfeeq_answer_feedback", {
      messageId,
      vote: "down",
      reason: withReason,
      // only sent when the reason is «سبب آخر»; the free text is the whole
      // value of that option
      detail: withReason === "other" ? detail.trim() : undefined,
    });
    onSubmitted();
    close();
    toast.success("شكرًا لملاحظتك");
  };

  const submit = () => {
    if (!reason) {
      setError("اختر سببًا، أو اضغط «تخطّي»");
      return;
    }
    if (reason === "other" && !detail.trim()) {
      setError("اكتب سبب التقييم أو اختر سببًا آخر");
      return;
    }
    record(reason);
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      title="ما المشكلة في هذه الإجابة؟"
    >
      <div className="grid grid-cols-1 gap-3">
        <p className="font-rf-ui text-rf-text-3 text-[13px]/[1.6]">
          اختر السبب الأقرب. ملاحظتك تساعدنا على تحسين المصادر والأحكام
          المعروضة.
        </p>

        <div role="radiogroup" aria-label="سبب التقييم" className="grid grid-cols-1 gap-2">
          {REASONS.map((option) => (
            <label
              key={option.value}
              className={cn(
                "rounded-rf-sm flex min-h-11 cursor-pointer items-center gap-3 border-[1.5px] px-4 py-2",
                "font-rf-ui text-rf-text text-[15px]/[1.6]",
                reason === option.value
                  ? "border-rf-accent bg-rf-accent-soft"
                  : "border-rf-line bg-rf-surface hover:border-rf-line-strong",
                "has-[input:focus-visible]:outline-rf-focus has-[input:focus-visible]:outline-[3px] has-[input:focus-visible]:outline-offset-2",
              )}
            >
              <input
                type="radio"
                name={`rf-reason-${messageId}`}
                value={option.value}
                checked={reason === option.value}
                onChange={() => {
                  setReason(option.value);
                  setError(null);
                }}
                className={cn(
                  "m-0 grid size-5.5 shrink-0 appearance-none place-items-center rounded-full",
                  "border-rf-line-strong bg-rf-surface border-[1.5px] outline-none",
                  "checked:border-rf-accent",
                  "after:bg-rf-accent after:hidden after:size-2.5 after:rounded-full after:content-['']",
                  "checked:after:block",
                )}
              />
              {option.label}
            </label>
          ))}
        </div>

        {reason === "other" ? (
          <Field label="اكتب السبب" htmlFor={`rf-detail-${messageId}`}>
            <Textarea
              id={`rf-detail-${messageId}`}
              value={detail}
              onChange={(event) => {
                setDetail(event.target.value);
                setError(null);
              }}
              placeholder="اشرح ما لاحظته باختصار"
            />
          </Field>
        ) : null}

        <div aria-live="polite">
          {error ? <ErrorMessage>{error}</ErrorMessage> : null}
        </div>

        <div className="grid grid-cols-1 gap-2">
          <Button block onClick={submit}>
            إرسال
          </Button>
          {/* Skipping still records the vote. The thumb-down is the signal; the
              reason is the elaboration, and demanding it would cost the signal. */}
          <Button variant="ghost" block onClick={() => record(null)}>
            تخطّي
          </Button>
        </div>
      </div>
    </Modal>
  );
}
