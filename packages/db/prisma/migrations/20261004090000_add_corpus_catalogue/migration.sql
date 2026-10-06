-- Book and author metadata for the classical corpus, so a question naming a
-- source can be resolved to the book ids retrieval filters on.
CREATE TABLE "CorpusAuthor" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "death" INTEGER,
    CONSTRAINT "CorpusAuthor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CorpusBook" (
    "id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "titleNormalized" TEXT NOT NULL,
    "authorId" INTEGER,
    "category" TEXT,
    "pageCount" INTEGER,
    CONSTRAINT "CorpusBook_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CorpusAuthor_nameNormalized_idx" ON "CorpusAuthor"("nameNormalized");
CREATE INDEX "CorpusBook_titleNormalized_idx" ON "CorpusBook"("titleNormalized");
CREATE INDEX "CorpusBook_authorId_idx" ON "CorpusBook"("authorId");

ALTER TABLE "CorpusBook" ADD CONSTRAINT "CorpusBook_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "CorpusAuthor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
