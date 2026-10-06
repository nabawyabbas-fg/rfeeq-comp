-- Which corpora a hosting site's search tool draws from.
CREATE TYPE "RetrievalMode" AS ENUM ('PRIMARY', 'SECONDARY', 'BOTH');

ALTER TABLE "Hosting"
  ADD COLUMN "retrievalMode" "RetrievalMode" NOT NULL DEFAULT 'PRIMARY',
  ADD COLUMN "secondaryNamespaceId" TEXT;

ALTER TABLE "Hosting"
  ADD CONSTRAINT "Hosting_secondaryNamespaceId_fkey"
  FOREIGN KEY ("secondaryNamespaceId") REFERENCES "namespace"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Hosting_secondaryNamespaceId_idx" ON "Hosting"("secondaryNamespaceId");
