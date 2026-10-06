-- One corpus comparison is three chats sharing a comparisonId, each tagged
-- with the retrieval mode that produced it.
ALTER TABLE "chat"
  ADD COLUMN "comparisonId" TEXT,
  ADD COLUMN "retrievalMode" "RetrievalMode";

CREATE INDEX "chat_comparisonId_idx" ON "chat"("comparisonId");
