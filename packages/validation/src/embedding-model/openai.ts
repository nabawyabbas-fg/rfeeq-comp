import { z } from "zod/v4";

export const openaiEmbeddingModelEnum = z
  .enum(["text-embedding-3-small", "text-embedding-3-large"])
  .meta({
    id: "openai-embedding-model-enum",
    description: "The OpenAI embedding model enum.",
  });

export const OpenAIEmbeddingConfigSchema = z
  .object({
    provider: z.literal("OPENAI"),
    model: openaiEmbeddingModelEnum,
    apiKey: z.string(),
    baseUrl: z
      .url()
      .optional()
      .describe(
        "Base URL of an OpenAI-compatible embeddings endpoint. Set this to use a self-hosted model server (vLLM, Ollama, LiteLLM, Infinity) instead of OpenAI.",
      ),
  })
  .meta({
    id: "openai-embedding-config",
    title: "OpenAI Embedding Config",
  });
