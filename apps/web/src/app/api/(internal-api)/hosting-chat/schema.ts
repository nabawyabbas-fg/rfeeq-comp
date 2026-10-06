import { messagesSchema } from "@/schemas/chat";
import { z } from "zod/v4";

import { llmSchema } from "@agentset/validation";

export const hostingChatSchema = z.object({
  messages: messagesSchema,
  /** Visitor's model choice; falls back to the site's configured model. */
  llmModel: llmSchema.optional(),
  /** Optional separate model for choosing search queries. */
  extractionModel: llmSchema.optional(),
  /**
   * How much detail the reader has asked for.
   *
   * A reader preference rather than a site setting, so it arrives per request.
   * Absent or "standard" changes nothing.
   */
  answerDepth: z.enum(["short", "standard", "detailed"]).optional(),
});
