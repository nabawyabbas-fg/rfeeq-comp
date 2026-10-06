# Intent map — DRAFT, for discussion

> **Not implemented.** This is the starting point for the "divide the sources by
> intent" conversation, not a decision. Nothing in the code reads it yet.

## Why intent, and why it is not enough on its own

The brief carries two independent axes, and conflating them would lose one:

- **Intent** — which domain the question belongs to, and therefore which part of
  the allow-list may answer it. Comes from the domain table in
  `approved-sources.md`.
- **Level (أ/ب/ج/د)** — what the system is permitted to *assert* once it has the
  material. Comes from `scope-and-levels.md`.

They are genuinely orthogonal. `ما حكم صلاة المسافر؟` and
`أنا مسافر غدًا، هل أقصر الصلاة؟` share the intent **fiqh** and the same
retrieved passages, but the first is level (ب) — answer from the approved
material with its reference — and the second is level (د), where the system must
not rule at all. A single "fiqh profile" would answer both identically, which
fails the brief on the second.

This is the structural break from the current Rfeeq design, which selects one
prompt per **namespace**. Namespace maps onto intent reasonably well, but there
is no level axis at all today.

## Candidate intents

| Intent | المجال in the brief | Approved sources | Default level | Usage rule that must be enforced |
| --- | --- | --- | --- | --- |
| `quran` | القرآن الكريم | مجمع الملك فهد · `quranenc.com` · `quranpedia.net` | أ | verse transmission verified against the canonical text |
| `tafsir` | التفسير | first three centuries · `dorar.net/tafseer` · `tafsir.net` | ب | mufassir's words kept distinct from the āya |
| `hadith` | الحديث النبوي | الصحيحان · `dorar.net/hadith` · `hadeethenc.com` · `shamela.ws` | أ | never cited without **source and grading** |
| `aqida` | العقيدة والتعريف بالإسلام | first three centuries · `dorar.net/aqeeda` | ب / ج | what the Companions and Tābi‘ūn held |
| `fiqh` | الفقه العام | four madhhabs · `dorar.net/feqhia` · الموسوعة الفقهية الكويتية | ب / ج | no personal fatwa, **no automated tarjīḥ** |
| `sira-history` | السيرة والتاريخ | first three centuries · `dorar.net/history` | ب / ج | established facts; flag what needs caution |
| `shubuhat` | الشبهات والأسئلة المتكررة | بيّنات `dawa.center/file/7937` · بيان الإسلام | ب | dialogical; audience-aware; no hostility mirroring |
| `terminology` | الترجمة والمصطلحات | `islamic-content.com/dictionary` · `terminologyenc.com` | أ | approved equivalent **beats** fluent translation |
| `dawa` | الموضوعات الدعوية | `dawa.center` · `islamic-content.com` | ب | by country / religion / language / audience segment |

And one routing outcome that is **not** a corpus:

| `fatwa-referral` | — | none | **د** | general information only, then refer to a qualified body |

A level-(د) question does not get a different corpus. It gets a different
*answer contract*: the system may explain what the books say in general, and
must not apply it to the asker's situation.

## Open questions — these need deciding before any code

1. **Where does classification happen?** A pre-retrieval classifier call, or an
   extra tool the agent calls, or inferred from which corpus returned the best
   chunks? The first is predictable and adds latency; the third is free but
   cannot produce `fatwa-referral`, because that outcome depends on the
   *question's* shape, not on what was retrieved.

2. **Multi-intent questions.** `ما الدليل على وجوب الزكاة؟` is `quran` +
   `hadith` + `fiqh`. Does intent select a set of corpora (fan-out, like the
   existing pooled pane) or one primary with fallbacks?

3. **Level and intent disagreeing.** A personal-case question with `quran`
   intent — e.g. a verse quoted to justify an individual act. Level (د) has to
   win. Worth stating as a precedence rule rather than leaving it to the model.

4. **Does the existing corpus qualify?** Of what is already ingested in Rfeeq,
   only `islamqa.info` appears on the allow-list, and the Turath corpus overlaps
   `shamela.ws` partially but was not harvested from the approved editions. This
   needs auditing book by book before any of it is used as competition evidence
   — the honest default is that the competition instance ingests fresh from the
   approved platforms.

5. **Level (د) detection is the highest-stakes classifier in the system.** A
   false negative means issuing a fatwa, which is explicitly out of scope. It
   should fail toward (د) when uncertain, which will cost some level-(ب)
   questions an unnecessary referral. That trade-off is worth taking
   deliberately rather than by accident.

## What is reusable as-is

- `corpus-prompts.ts` — the composition pattern (shared blocks + per-profile
  blocks) extends to intents directly. `CorpusProfile` becomes `Intent`, and a
  second `ResponseLevel` axis is added to the composer.
- `verify-quotes.ts` — the render-time quote check already implements most of
  criterion 4 (مقاومة الهلوسة) for quoted text.
- `corpus-scope.ts` — named-book/author scoping, useful for
  "من كتاب كذا" questions, already resolves and reports ambiguity.
- `scripture-panel.tsx` — the quote panel is where a verified verse with its
  sūra/āya and an approved translation would surface.
