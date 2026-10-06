import type { AgenticTools } from "@/lib/agentic-search/tools";
import type { UseChatHelpers } from "@ai-sdk/react";
import type { InferUITools, UIDataTypes, UIMessage } from "ai";

import type { AnswerMetrics } from "@/lib/agentic-search/metrics";

/** Attached to the assistant message so the UI can show a cost/latency breakdown. */
type MyMetadata =
  | {
      metrics?: AnswerMetrics;
      /*
       * What to ask next, written once from this answer and then kept.
       *
       * Stored on the message rather than regenerated because it is a property
       * *of this answer* — the same answer yields the same suggestions, so
       * asking a model again on every reload spends a call to arrive back where
       * it started. They are rendered under every answer in a thread, so a
       * reopened conversation used to fire one request per turn in it.
       */
      followUps?: string[];
    }
  | undefined;

// Create a new custom message type with your own metadata
export type MyUIMessage = UIMessage<
  MyMetadata,
  UIDataTypes,
  InferUITools<AgenticTools>
>;
export type MyUseChat = UseChatHelpers<MyUIMessage>;
