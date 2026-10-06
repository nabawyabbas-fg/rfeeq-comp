/* eslint-disable @typescript-eslint/no-namespace */
import type {
  DocumentPayload as _DocumentPayload,
  DocumentProperties as _DocumentProperties,
  IngestJobConfig as _IngestJobConfig,
  IngestJobPayload as _IngestJobPayload,
  EmbeddingConfig,
  LLM,
  RerankingModel,
  VectorStoreConfig,
} from "@agentset/validation";

declare global {
  export namespace PrismaJson {
    type ConnectionConfig = {
      authType: "OAUTH2";
      credentials: {
        accessToken: string;
        refreshToken: string | null;
      };
    };

    type IngestJobPayload = _IngestJobPayload;
    type IngestJobConfig = _IngestJobConfig;
    type NamespaceVectorStoreConfig = VectorStoreConfig;

    type NamespaceFileStoreConfig = {
      provider: "S3";
      bucket: string;
      accessKeyId: string;
      secretAccessKey: string;
      endpoint: string;
      region: string;
      prefix?: string;
    };

    type NamespaceEmbeddingConfig = EmbeddingConfig;
    type DocumentProperties = _DocumentProperties;

    type HostingRerankConfig = { model: RerankingModel; limit?: number };
    type HostingLLMConfig = { model: LLM };

    type DocumentSource = _DocumentPayload;
    type DocumentConfig = _IngestJobConfig;

    /**
     * The AI SDK UIMessage `parts` array, persisted verbatim. Typed loosely on
     * purpose: the part union is owned by the SDK and widens between versions,
     * and a stored conversation must still load after an upgrade.
     */
    type ChatMessageParts = unknown[];

    /**
     * The AI SDK UIMessage `metadata` object, persisted verbatim. Holds the
     * per-answer cost/latency breakdown (`metrics`) so a reloaded conversation
     * still shows what each turn cost, rather than losing it with the session.
     * Loosely typed for the same reason as ChatMessageParts.
     */
    type ChatMessageMetadata = Record<string, unknown>;
  }
}
