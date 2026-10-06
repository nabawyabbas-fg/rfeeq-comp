import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod/v4";

export const env = createEnv({
  server: {
    DEFAULT_PINECONE_API_KEY: z.string(),
    DEFAULT_PINECONE_HOST: z.url(),

    SECONDARY_PINECONE_API_KEY: z.string(),
    SECONDARY_PINECONE_HOST: z.url(),

    DEFAULT_TURBOPUFFER_API_KEY: z.string(),

    DEFAULT_AZURE_RESOURCE_NAME: z.string(),
    DEFAULT_AZURE_API_KEY: z.string(),

    // When set, generation goes to OpenAI directly instead of Azure. Same
    // models, so this is a deployment detail rather than a behaviour change.
    OPENAI_API_KEY: z.string().optional(),
    GOOGLE_API_KEY: z.string().optional(),
    OPENROUTER_API_KEY: z.string().optional(),

    DEFAULT_COHERE_API_KEY: z.string(),
    DEFAULT_ZEROENTROPY_API_KEY: z.string(),

    PARTITION_API_KEY: z.string(),
    PARTITION_API_URL: z.url(),
  },
  runtimeEnv: {
    DEFAULT_PINECONE_API_KEY: process.env.DEFAULT_PINECONE_API_KEY,
    DEFAULT_PINECONE_HOST: process.env.DEFAULT_PINECONE_HOST,

    SECONDARY_PINECONE_API_KEY: process.env.SECONDARY_PINECONE_API_KEY,
    SECONDARY_PINECONE_HOST: process.env.SECONDARY_PINECONE_HOST,

    DEFAULT_TURBOPUFFER_API_KEY: process.env.DEFAULT_TURBOPUFFER_API_KEY,

    DEFAULT_AZURE_RESOURCE_NAME: process.env.DEFAULT_AZURE_RESOURCE_NAME,
    DEFAULT_AZURE_API_KEY: process.env.DEFAULT_AZURE_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,

    DEFAULT_COHERE_API_KEY: process.env.DEFAULT_COHERE_API_KEY,
    DEFAULT_ZEROENTROPY_API_KEY: process.env.DEFAULT_ZEROENTROPY_API_KEY,

    PARTITION_API_KEY: process.env.PARTITION_API_KEY,
    PARTITION_API_URL: process.env.PARTITION_API_URL,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
