# adkar corpus DB — hand-applied schema

The scripture panel reads the Qurʾān and hadith corpora from the **`adkar`**
database on **:5432**. That is a different server from the app's own
`agentset_comp` on :5433, it is **not** managed by Prisma, and it is shared with
other applications on this box.

So anything this app needs there is applied by hand and recorded here. Run the
files in order against `adkar` as a superuser; every one is idempotent and
additive — no file drops or rewrites data another app owns.

```bash
psql -h localhost -p 5432 -U adkar -d adkar -v ON_ERROR_STOP=1 -f 001-scripture-lookup.sql
# the CREATE INDEX CONCURRENTLY statements cannot run inside a transaction and
# are listed at the end of that file to be run one at a time
```

| File | What it adds |
| --- | --- |
| `001-scripture-lookup.sql` | `rfeeq_norm_ar()`, `quran_verse_imlai`, three trigram indexes, the `rfeeq_ro` role |

## Why `quran_verse_imlai` exists

`verses.ar_text_norm` preserves **ʿUthmānī rasm** — `الصلوه`, `وءاتوا`,
`الركعين`. A model quotes **modern orthography** — `الصلاة`, `وآتوا`,
`الراكعين`. Measured across the whole Qurʾān, **4,000 of 6,236 verses (64%)
differ**, so matching a quotation against `verses` fails on two thirds of
clicks.

It is not fixable by rule: `الركعين` → `الراكعين` restores a letter the rasm
does not contain. But `quran_words.word` already holds the modern spelling, so
the modern text of a verse is a concatenation of its words rather than a
transliteration guess. That is what this table materialises — rebuilt rather
than computed per click, because aggregating all 77,432 words takes ~830 ms.

## The normalisation contract

`public.rfeeq_norm_ar()` is a step-for-step mirror of `normaliseArabic()` in
`apps/web/src/lib/verify-quotes.ts`, and was verified to produce **identical
output on all 6,236 verses**.

That equivalence is load-bearing: the app normalises the clicked quotation in
JS and matches it against `text_imlai_norm`, which was normalised in SQL. If
either side changes and the other does not, lookups do not error — they
silently stop matching. Re-run the comparison when touching either.

## Privileges

`rfeeq_ro` has `SELECT` on the lookup tables only. It holds no write grant
anywhere, cannot create objects, is not a superuser, and is deliberately denied
`public.fatawas` and `public.llm_calls`. Adding a table to the panel means
adding a `GRANT SELECT` here too.
