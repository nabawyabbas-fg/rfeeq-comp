-- Scripture-panel lookup objects for the `adkar` corpus DB (:5432).
--
-- Applied by hand; see README.md in this directory for why this database is not
-- Prisma-managed. Idempotent and additive — nothing here rewrites or drops data
-- another application owns.

-- ---------------------------------------------------------------------------
-- 1. Arabic folding, identical to the app's
-- ---------------------------------------------------------------------------
-- A step-for-step mirror of normaliseArabic() in
-- apps/web/src/lib/verify-quotes.ts. Verified to produce identical output on all
-- 6,236 verses.
--
-- The equivalence is load-bearing: the app folds the clicked quotation in JS and
-- matches it against text_imlai_norm, folded here. If one side changes without
-- the other, lookups do not error — they silently stop matching.
CREATE OR REPLACE FUNCTION public.rfeeq_norm_ar(t text) RETURNS text AS $$
  SELECT trim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
         regexp_replace(regexp_replace(regexp_replace(
    $1, '[ً-ْٰـ]',  '',  'g'),   -- tashkil, dagger alef, tatweel
         '[أإآٱ]',   'ا', 'g'),   -- hamza-carrying alef forms
         'ى',        'ي', 'g'),
         'ة',        'ه', 'g'),
         '[ؤئ]',     'ء', 'g'),
         '[^ء-ي[:space:]]', ' ', 'g'),  -- anything outside the Arabic letters
         '[[:space:]]+',    ' ', 'g'))
$$ LANGUAGE sql IMMUTABLE;

COMMENT ON FUNCTION public.rfeeq_norm_ar IS
  'Arabic folding identical to normaliseArabic() in the Rfeeq web app. Used to build quran_verse_imlai.';

-- ---------------------------------------------------------------------------
-- 2. Modern-orthography verse text
-- ---------------------------------------------------------------------------
-- verses.ar_text_norm preserves Uthmani rasm (الصلوه / وءاتوا / الركعين) while a
-- model quotes modern spelling (الصلاة / وآتوا / الراكعين). 4,000 of 6,236 verses
-- (64%) differ, and the difference is not reversible by rule — الركعين -> الراكعين
-- restores a letter the rasm does not contain.
--
-- quran_words.word already holds the modern spelling, so the modern text of a
-- verse is a concatenation of its words. Materialised rather than computed per
-- click: aggregating all 77,432 words takes ~830 ms.
CREATE TABLE IF NOT EXISTS public.quran_verse_imlai (
  verse_key       text    PRIMARY KEY,
  surah           integer NOT NULL,
  ayah            integer NOT NULL,
  text_imlai      text    NOT NULL,
  text_imlai_norm text    NOT NULL
);

COMMENT ON TABLE public.quran_verse_imlai IS
  'Modern-orthography verse text rebuilt from quran_words, for matching quoted scripture. Derived — rebuild with the INSERT below.';

-- Rebuild. No join back to quran_words for surah/ayah: word numbering is not
-- always 1-based — 2:1 ("الم") has a single row numbered 5 — and joining on
-- word_no = 1 silently drops it. The key itself is the reliable source.
TRUNCATE public.quran_verse_imlai;
INSERT INTO public.quran_verse_imlai (verse_key, surah, ayah, text_imlai, text_imlai_norm)
SELECT verse_key,
       split_part(verse_key, ':', 1)::int,
       split_part(verse_key, ':', 2)::int,
       txt,
       public.rfeeq_norm_ar(txt)
FROM (SELECT verse_key, string_agg(word, ' ' ORDER BY word_no) AS txt
      FROM public.quran_words GROUP BY verse_key) t;

-- expect 6236, matching (SELECT count(*) FROM public.verses)
-- SELECT count(*) FROM public.quran_verse_imlai;

-- ---------------------------------------------------------------------------
-- 3. Read-only role for the web app
-- ---------------------------------------------------------------------------
-- The server had only `adkar` (superuser) and `postgres`, so without this the
-- app would hold superuser on a 13 GB shared database.
--
-- Set a real password out of band; do not commit one:
--   ALTER ROLE rfeeq_ro PASSWORD '...';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rfeeq_ro') THEN
    CREATE ROLE rfeeq_ro LOGIN;
  END IF;
END $$;
ALTER ROLE rfeeq_ro NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;

COMMENT ON ROLE rfeeq_ro IS
  'Read-only, for the Rfeeq scripture panel. SELECT on the Quran/hadith lookup tables only — deliberately not fatawas or llm_calls.';

GRANT CONNECT ON DATABASE adkar TO rfeeq_ro;
GRANT USAGE ON SCHEMA public, jk TO rfeeq_ro;

GRANT SELECT ON public.quran_verse_imlai, public.verses, public.quran_words,
                public.tafsir_classical, public.tafsir_mukhtasar,
                public.ayah_annotations
  TO rfeeq_ro;
GRANT SELECT ON public.hadiths, public.hadith_sunnah_dorar_gradings TO rfeeq_ro;
GRANT SELECT ON jk.corpus_hadith, jk.takhrij, jk.matn_match, jk.shahid_group
  TO rfeeq_ro;
GRANT EXECUTE ON FUNCTION public.rfeeq_norm_ar(text) TO rfeeq_ro;

-- ---------------------------------------------------------------------------
-- 4. Trigram indexes — run these OUTSIDE a transaction, one at a time
-- ---------------------------------------------------------------------------
-- CONCURRENTLY because this database is shared: a plain CREATE INDEX takes a
-- lock that blocks writes from the other applications using these tables.
--
-- Measured before -> after:
--   hadiths.ar_text_norm       2,613 ms -> 5.5 ms   (index 27 MB)
--   jk.corpus_hadith.text_norm 4,805 ms -> 14.9 ms  (index 90 MB)
--   quran_verse_imlai                   -> 3.5 ms   (index 1.4 MB)

-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quran_verse_imlai_norm_trgm
--   ON public.quran_verse_imlai USING gin (text_imlai_norm gin_trgm_ops);

-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hadiths_ar_text_norm_trgm
--   ON public.hadiths USING gin (ar_text_norm gin_trgm_ops);

-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jk_corpus_hadith_text_norm_trgm
--   ON jk.corpus_hadith USING gin (text_norm gin_trgm_ops);
