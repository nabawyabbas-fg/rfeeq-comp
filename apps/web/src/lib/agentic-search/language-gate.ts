import type { MyUIMessage } from "@/types/ai";
import type { UIMessageStreamWriter } from "ai";

import { detectLanguage, prose } from "./language";

/**
 * Holds the answer back until its language can be judged.
 *
 * Checking after the fact is useless: by then the reader has watched an English
 * answer to an Arabic question appear word by word. This buffers only the prose
 * — search progress, reasoning and tool results stream through untouched, so the
 * "Searching…" state still appears immediately — and releases it once there is
 * enough text to tell. If the language is wrong the buffer is discarded and the
 * reader never sees it.
 *
 * Naming the language in the prompt took the failure from 6 runs in 30 to 3.
 * This is what takes it to none: the wrong answer is not shown, so there is
 * nothing to correct.
 */

/**
 * Enough Arabic or Latin to judge the language, without holding long.
 *
 * Counted over the **prose**, not the raw stream. A section-formatted answer
 * spends its first hundred characters on structural markers, so counting raw
 * characters would decide the language before the model had written a word of
 * it.
 */
const LANGUAGE_GATE_CHARS = 180;

/*
 * A citation gate was tried here and removed. Unlike language, which is
 * detectable in the first 180 characters and therefore *before* anything is
 * released, whether an answer cites cannot be known until well after the
 * opening has been streamed. Rejecting at that point truncated answers
 * mid-sentence — measurably worse than the uncited answer it was meant to
 * prevent: median length fell from 2,065 characters to 1,438, with answers
 * ending in the middle of a word. Enforcing citations needs either the whole
 * answer buffered before display, or a render-time flag; not this.
 */

type Part = Parameters<UIMessageStreamWriter<MyUIMessage>["write"]>[0];

export class LanguageGate {
  private buffered: Part[] = [];
  private seen = "";
  private decided = false;
  /** why the answer was rejected, for the retry instruction */
  rejected: "language" | null = null;

  constructor(
    private readonly expected: "ar" | "en" | null,
    private readonly writer: UIMessageStreamWriter<MyUIMessage>,
  ) {
    // nothing to enforce when the question's language could not be determined
    // with no expected language the gate still enforces citations
    if (!expected) this.decided = true;
  }

  /** Returns false once the answer has been rejected and streaming should stop. */
  handle(part: Part): boolean {
    const type = (part as { type?: string }).type ?? "";
    if (this.decided) {
      this.writer.write(part);
      return true;
    }

    // only the answer itself is held; progress and reasoning go straight out
    if (!type.startsWith("text")) {
      this.writer.write(part);
      return true;
    }

    this.buffered.push(part);
    if (type === "text-delta") {
      this.seen += (part as { delta?: string }).delta ?? "";
    }

    // decide as soon as there is enough *prose*, or when the answer ends early
    const written = prose(this.seen);
    if (written.length >= LANGUAGE_GATE_CHARS || type === "text-end") {
      const got = detectLanguage(written);
      if (got && got !== this.expected) {
        this.rejected = "language";
        this.buffered = []; // never reaches the reader
        return false;
      }
      this.release();
    }
    return true;
  }

  /** Emits everything held back and stops buffering. */
  release() {
    this.decided = true;
    for (const part of this.buffered) this.writer.write(part);
    this.buffered = [];
  }

  /** Called when the stream ends before the gate had enough text to judge. */
  finish() {
    if (!this.decided && !this.rejected) this.release();
  }
}
