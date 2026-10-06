import { messagesSchema } from "@/schemas/chat";
import { z } from "zod/v4";

export const rfeeqChatSchema = z.object({
  messages: messagesSchema,
  /** The reader's detail preference; absent or "standard" changes nothing. */
  answerDepth: z.enum(["short", "standard", "detailed"]).optional(),
  /** Who is reading: it decides which commentary editions are read. */
  expertise: z.enum(["general", "specialist"]).optional(),
});
