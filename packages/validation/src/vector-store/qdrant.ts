import { z } from "zod/v4";

export const QdrantVectorStoreConfigSchema = z
  .object({
    provider: z.literal("QDRANT"),
    url: z
      .url()
      .describe(
        "Base URL of the Qdrant instance, e.g. http://qdrant:6333 or https://xyz.cloud.qdrant.io:6333",
      ),
    apiKey: z
      .string()
      .optional()
      .describe(
        "API key for the Qdrant instance. Optional for instances that do not require auth.",
      ),
  })
  .meta({
    id: "qdrant-config",
    title: "Qdrant Config",
  });
