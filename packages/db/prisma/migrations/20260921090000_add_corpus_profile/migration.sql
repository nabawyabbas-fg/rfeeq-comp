-- Which kind of material a corpus holds, so retrieval instructions can match it.
--
-- Keyed to the namespace rather than the retrieval mode: a comparison run
-- searches several corpora side by side, and each pane must get the prompt for
-- the corpus it is actually searching. Mode-based selection only works when
-- primary is always the classical corpus, which is true for a hosted site and
-- false in the playground.
CREATE TYPE "CorpusProfile" AS ENUM ('CLASSICAL', 'FATWA', 'ENCYCLOPEDIA');

ALTER TABLE "namespace"
  ADD COLUMN "corpusProfile" "CorpusProfile" NOT NULL DEFAULT 'CLASSICAL';

UPDATE "namespace" SET "corpusProfile" = 'FATWA'        WHERE id = 'fatawa';
UPDATE "namespace" SET "corpusProfile" = 'ENCYCLOPEDIA' WHERE id = 'erej';
