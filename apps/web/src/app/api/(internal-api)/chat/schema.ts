import { baseQueryVectorStoreSchema } from "@/schemas/api/query";
import { messagesSchema } from "@/schemas/chat";
import { z } from "zod/v4";

import {
  llmSchema,
  llmSchemaWithDefault,
  rerankerSchemaWithDefault,
} from "@agentset/validation";

export const chatSchema = baseQueryVectorStoreSchema
  .omit({ query: true, topK: true, rerankLimit: true })
  .extend({
    topK: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(30)
      .describe(
        "The number of results to fetch from the vector store for each semantic search. Defaults to `30`.",
      ),
    rerankLimit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(10)
      .describe(
        "The number of results the model sees per search. Defaults to `10`.",
      ),
    systemPrompt: z
      .string()
      .optional()
      .describe(
        "Custom instructions for the chat. Defaults to the agentic search system prompt; custom prompts are augmented with the platform tool and citation contract.",
      ),
    messages: messagesSchema,
    temperature: z.number().optional(),
    mode: z
      .enum(["accurate", "fast", "normal", "agentic", "deepResearch"])
      .optional()
      .default("accurate")
      // legacy modes (normal/agentic/deepResearch) map to accurate
      .transform((mode) =>
        mode === "fast" ? ("fast" as const) : ("accurate" as const),
      )
      .describe(
        "accurate: reranked agentic search (default). fast: agentic search without reranking.",
      ),
    rerankModel: rerankerSchemaWithDefault,
    llmModel: llmSchemaWithDefault,
    extractionModel: llmSchema
      .optional()
      .describe(
        "Model that chooses the search queries. Defaults to the platform's extraction model; pass the same value as llmModel to have one model do both jobs.",
      ),
    /**
     * Which corpora to search. The playground uses this to run the same
     * question against each corpus alone and against all of them pooled, so
     * they can be compared side by side before a site is configured.
     */
    retrievalMode: z
      .enum(["PRIMARY", "SECONDARY", "TERTIARY", "BOTH"])
      .optional()
      .default("PRIMARY")
      .describe(
        "PRIMARY searches this namespace; SECONDARY and TERTIARY each search their own namespace instead; BOTH pools candidates from every namespace supplied and reranks them together.",
      ),
    secondaryNamespaceId: z
      .string()
      .optional()
      .describe(
        "The second namespace to search. Required for SECONDARY; pooled by BOTH when present. Must belong to the same organization.",
      ),
    /**
     * Optional third corpus. Separate from `secondaryNamespaceId` rather than
     * a list, so an existing client that sends only a secondary keeps its exact
     * previous behaviour.
     */
    tertiaryNamespaceId: z
      .string()
      .optional()
      .describe(
        "The third namespace to search. Required for TERTIARY; pooled by BOTH when present. Must belong to the same organization.",
      ),
  });
// note: rerankLimit > topK is clamped in the route instead of rejected, since
// both fields have defaults and legacy clients may send mismatched pairs
