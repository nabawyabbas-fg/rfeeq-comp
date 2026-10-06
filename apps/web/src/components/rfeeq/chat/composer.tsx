"use client";

import { useEffect, useRef } from "react";

import { cn } from "@agentset/ui/cn";

import { Icon } from "../icon";

/**
 * The lines the placeholder cycles through.
 *
 * «اسأل رفيق» first, then one question per corpus — Qurʾān, hadith, fiqh — so
 * an arriving reader learns what the system is for from the field itself rather
 * than from a paragraph above it.
 */
const PLACEHOLDERS = [
  "اسأل رفيق",
  "ما تفسير الآية 43 من سورة النحل؟",
  "ما صحة حديث «اطلبوا العلم ولو بالصين»؟",
  "ما أحكام الجمع والقصر في السفر؟",
];

/** 140px — about five lines, past which the thread matters more than the draft. */
const MAX_HEIGHT = 140;

export function Composer({
  value,
  onChange,
  onSubmit,
  busy,
  onStop,
  disabled,
  autoFocus,
}: {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  /** A run is in flight; the send button becomes stop. */
  busy?: boolean;
  onStop?: () => void;
  /** No corpus configured — the field explains itself instead of accepting. */
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);

  // Grow with the content up to the cap. Height is reset to `auto` first,
  // because scrollHeight never shrinks below the height already set.
  useEffect(() => {
    const element = textarea.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div
      className={cn(
        "border-rf-line-strong relative flex min-h-14 items-center gap-2 rounded-[28px] border",
        "bg-rf-surface py-1.5 ps-5 pe-2",
        "focus-within:border-rf-text-2",
      )}
    >
      <label className="sr-only" htmlFor="rf-composer">
        اسأل رفيق
      </label>

      {/*
       * The cycling placeholder is an overlay, not the native one: a real
       * placeholder cannot animate. The native attribute is kept as a single
       * space so the field is never treated as empty-with-placeholder by the
       * browser's own styling, and the visible text is transparent.
       */}
      {value.length === 0 ? (
        <span
          aria-hidden="true"
          id="rf-composer-examples"
          className="pointer-events-none absolute inset-y-0 start-5 end-15 overflow-hidden"
        >
          {PLACEHOLDERS.map((line, index) => (
            <span
              key={line}
              style={{ animationDelay: `${index * 4}s` }}
              className={cn(
                "absolute inset-x-0 top-1/2 truncate whitespace-nowrap",
                "font-rf-ui text-rf-text-3 text-base/[1.8]",
                "motion-safe:animate-rf-placeholder opacity-0",
                // with motion reduced the cycle is off, so the first line
                // simply stands as the placeholder
                "motion-reduce:[&:first-child]:translate-y-[-50%] motion-reduce:[&:first-child]:opacity-100",
              )}
            >
              {line}
            </span>
          ))}
        </span>
      ) : null}

      <textarea
        id="rf-composer"
        ref={textarea}
        rows={1}
        value={value}
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder=" "
        aria-describedby="rf-composer-examples"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          // Enter sends, Shift+Enter breaks the line. Not while composing: an
          // IME confirming a candidate with Enter would otherwise send.
          if (
            event.key !== "Enter" ||
            event.shiftKey ||
            event.nativeEvent.isComposing
          ) {
            return;
          }
          event.preventDefault();
          if (canSend && !busy) onSubmit();
        }}
        className={cn(
          "max-h-35 min-h-10 min-w-0 flex-1 resize-none border-0 bg-transparent py-2",
          "font-rf-ui text-rf-text text-base/[1.8] outline-0",
          "disabled:text-rf-text-3 placeholder:text-transparent",
        )}
      />

      <button
        type="button"
        onClick={busy ? onStop : onSubmit}
        disabled={busy ? !onStop : !canSend}
        aria-label={busy ? "إيقاف" : "إرسال"}
        className={cn(
          "grid size-10 shrink-0 cursor-pointer place-items-center self-center rounded-full border-0",
          "bg-rf-text text-rf-bg hover:bg-rf-text-2",
          "disabled:bg-rf-surface-2 disabled:text-rf-text-3 disabled:cursor-not-allowed",
          "focus-visible:outline-rf-focus outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2",
        )}
      >
        <Icon name={busy ? "pause" : "arrowup"} size="lg" />
      </button>
    </div>
  );
}

/**
 * The standing disclaimer under every composer.
 *
 * Present on both the home screen and the thread, deliberately. It is the
 * brief's الشفافية criterion in its plainest form — the reader is told this is
 * a tool, and told what it does not replace — and criterion 3's عدم الاستقلال
 * بالفتوى in the one place it is always visible.
 */
export function ComposerNote() {
  return (
    <p className="font-rf-ui text-rf-text-3 text-center text-[13px]/[1.6]">
      رفيق يعرض المصادر ولا يغني عن سؤال أهل العلم في حالتك الخاصة.
    </p>
  );
}
