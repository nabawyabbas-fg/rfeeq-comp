# The Rfeeq interface

What the approved prototype (_رفيق — النموذج التفاعلي_, v1.7) turned into, where
each part lives, and what is still a stub. Written for whoever picks this up
next; it is a record of decisions, not a tutorial.

## Where it is served

`comp.rfeeq.ai/` is now the **consumer chat**, not the dashboard. The dashboard
kept its own paths and is reached at `/admin`, which resolves the operator's
default organisation the way `/` used to.

| Path                      | Screen                                                        |
| ------------------------- | ------------------------------------------------------------- |
| `/`                       | chat — opening screen until a question is asked, thread after |
| `/c/<chatId>`             | one saved conversation, by link                               |
| `/login`                  | sign-in: Google / Apple / email code                          |
| `/login/profile`          | account completion — name, birth year, consent                |
| `/settings`               | account, preferences, plan, privacy                           |
| `/about`                  | عن رفيق                                                       |
| `/s/<shareId>`            | a shared conversation, read-only and public                   |
| `/admin` → `/<orgSlug>/…` | the dashboard, unchanged                                      |

`apps/web/src/lib/middleware/app.ts` splits the two, and
`isRfeeqPath` in `lib/constants.ts` holds the reserved first segments — an
organisation slugged `settings` would otherwise collide with the settings
screen.

## The tokens are the specification

`apps/web/src/styles/rfeeq.css` transcribes the prototype's values rather than
re-deriving them: the palette, the Arabic type scale, radii, shadows and
motion. Everything is namespaced `rf-` because the dashboard shares the
stylesheet and still runs on shadcn's `--color-accent` / `--color-background`;
an un-prefixed token would repaint it silently.

Components are Tailwind, composed from those tokens. That is what keeps a
rebuild from drifting: the numbers are not retyped per component.

Three things worth knowing:

- **Theme has three states.** next-themes writes both `class` (what Tailwind's
  `dark:` keys off, and what the dashboard already used) and `data-theme` (what
  the Rfeeq token blocks key off). System is the default. Anything that must be
  correct on the first paint — the theme toggle's icon and its label — is
  swapped in CSS, never in JavaScript, because `resolvedTheme` is undefined
  until mount and the wrong-way-round flip is visible.
- **`--rf-scale`** multiplies every body and Qurʾānic size token, so the reader's
  text-size preference resizes an āya and the prose explaining it together.
- **RTL** is set on a wrapper in `app/(rfeeq)/layout.tsx`, not on `<html>`:
  the root layout is shared with the LTR dashboard and Next gives one root
  layout no way to vary by route group. Direction inherits, so logical
  properties resolve correctly; what the wrapper cannot set is the document's
  own `lang`. Giving this group its own root layout would fix that and means
  moving every other top-level segment under a group of its own.

## The two axes

`apps/web/src/lib/rfeeq/intent.ts` implements what
[`intent-map.draft.md`](intent-map.draft.md) describes, and
`apps/web/test/rfeeq-intent.test.ts` holds it to the brief's twelve published
cases.

- **Intent** — nine corpus domains plus `fatwa-referral`, which is a routing
  outcome rather than a corpus.
- **Level** — أ/ب/ج/د, deciding what may be asserted.
- **Template** — which of the six approved presentations to render, derived
  from the two.

Level (د) **fails safe**, as the draft's open question 5 asks: an unmistakable
own-case marker (`صلاتي`, `عقدي`, `نسيت`) is enough on its own, while a bare
`أنا` needs a decision request or a ruling-shaped domain alongside it. A false
negative means issuing a fatwa; a false positive costs one referral.

**Terminology spans two levels**, which is not obvious until the brief's own
cases are read against each other. Case 8 («ترجم كلمة التوحيد إلى الإنجليزية»)
is a dictionary lookup and is (أ); case 12, a term carrying cultural weight that
has to be explained in context, is (ب). The classifier treated the whole domain
as (أ) at first — which licenses a confident literal translation of exactly the
terms `terminology.md` says must never be collapsed («الشريعة» into penal law,
«الفتوى» into ordinary information). A translation imperative is what separates
them now.

**The patterns are Arabic**, so a question in another language falls through to
`dawa`. Case 12 is explicitly «سؤال بلغة غير عربية», so this classifier cannot
route it; the test asserts the limitation rather than leaving it implicit.
Closing it needs either a translated probe or a model call — open question 1 in
the draft map.

Two notes on the patterns, both learned the hard way:

- JavaScript's `\b` is ASCII-only, so `/\bحديث\b/` matches **nothing**. Every
  pattern compiles through `words()`, which uses a Unicode-aware left boundary
  tolerating the clitic prefixes (ال, و, ب, ف, ل).
- Order encodes meaning. History precedes doubt because the brief files
  «هل الإسلام انتشر بالسيف؟» under السيرة والتاريخ — its expected handling is
  _تمييز السؤال التاريخي عن الاتهام العام_.

What the reader sees of all this is only what it changes: the referral notice
above a level-(د) answer, the relay note under a ruling, and which follow-up
questions are offered. There is no badge row — v1.3 removed it.

## Answers

The frame is `components/rfeeq/chat/answer.tsx`; the typography is
`answer-body.tsx`. The existing marking pipeline is reused wholesale —
citation repair, scripture marking, quote verification, uncited detection — and
only the rendering changed. Those passes encode findings from audited
conversations and were not worth re-implementing to restyle.

**Citations are numbers.** `RfeeqSourcesProvider` derives one ordering from the
retrieval order and shares it between the inline marker, the sources list and
the panel. An id that resolves to nothing renders as `[؟]` rather than
disappearing — a dropped marker would make an attributed sentence look
unattributed, which is the wrong correction.

**Revealed text is set apart typographically** — the reading face at 20/2.1,
with ﴿ ﴾ in the muṣḥaf face and the accent colour — because criterion 1 requires
the source text to be distinguishable from the generated explanation, and
typography is the honest way to do it.

`resolveCitationChunks` was extracted to `lib/citation-resolve.ts` so the old
pill and the new marker share one resolution; it encodes measured tolerances for
mistakes models make with chunk ids, and two copies would have drifted. The
captured answer in `../prompt-archive/answer-1xbet.md` shows why the tolerance
and the visible `[؟]` both matter — one of its fifteen citations is unresolved
in production.

**Direction resolves from the content**, not from the surface. The answer body
is `dir="auto"`, so an Arabic answer renders RTL and an English one LTR. The
prompt's own rule is to answer in the language of the question
(`../prompt-archive/language-lock.md`), the brief's case 12 is explicitly
non-Arabic, and 18% of the fatwa corpus is English — pinning this to RTL, which
an Arabic-first surface invites, renders all of those backwards.

**One presentation gap to expect once a corpus exists.** Real answers from this
corpus lead sections with `**عنوان:**` rather than a markdown heading — see
`answer-1xbet.md`. Those render as bold body text at 17px, not as the 19px
section headings the approved presentation uses. Styling `p > strong:only-child`
as a heading would close it, and is a guess about model output that should wait
until the competition prompts are written.

## The opening suggestions

The three chips on the empty thread are written rather than fixed, by
`lib/rfeeq/starters.ts` through `/api/rfeeq-starters`. A list that never changes
stops being a suggestion and becomes furniture.

They are generated under tighter constraints than the follow-ups, because this
is the *first* thing a reader sees and the home screen is a poor place to
discover that a suggested question is one the system answers badly. Three
guards keep the chips themselves identical whatever the model writes:

- **The icon is never the model's.** It comes from `routeQuestion`, so a chip
  carrying the muṣḥaf mark is one the router will actually send to the Qurʾān.
- **The label is capped** at 28 characters and an overlong one is dropped, not
  truncated: the row is three chips wide and a long label wraps it.
- **A suggestion the system would have to refuse is dropped** — a personal case,
  a verdict on a person. A chip is a button the reader will press, and one that
  ends in a referral wastes the press.

The curated trio renders from the first frame and is replaced when the written
set arrives, so the row never shifts — only its text changes. It is also what
stays if generation fails, which is why it is a known-good set rather than a
placeholder. The set is cached across visitors for ten minutes and once per
session on the client: a reader who starts three conversations should not watch
the chips change under them each time.

## What is real, and what is not

Working end to end: routing, the shell, history (list, rename, delete, search,
guest lock), the composer, sign-in with Google and the email code, account
completion, settings, privacy actions, sharing (schema, mint, revoke, public
page), the guest wall and the three-question daily limit, theme, text size, and
answer depth — which reaches the model as a real instruction block
(`lib/rfeeq/answer-depth.ts`, applied in the hosting-chat route).

## The three cases that were failing

`eval-questions.md` names them: **5, 6 and 11**.

- **Case 5** needed "referral behaviour that does not exist yet in any form".
  It exists now: level-(د) detection, the `fatwa-referral` outcome, and the
  notice above the answer saying the system does not rule on a particular case.
  The classification is tested; the _answer_ still has to honour it, which is
  prompt work.
- **Case 6** (refuse to invent a hadith, state that no matching evidence was
  found) is untouched. It is a prompt problem — `<tool_persistence_rules>`
  pushes toward searching again rather than returning a clean negative.
- **Case 11** (show the correct verse with sūra and āya) is untouched and needs
  data: `verify-quotes.ts` can tell that a quoted verse is unsupported but has
  no verse index to supply the right wording. The word-level ids from
  مجمع الملك فهد (`qurancomplex.gov.sa/quran-dev`) close it, and would also give
  the scripture panel something canonical to show instead of the span as the
  model rendered it.

`approved-sources.md` also flags three rules worth _checking_ rather than only
prompting: tafsir must separate the mufassir's words from the āya, hadith must
carry source **and** grading, and fiqh must not resolve disagreement on its own.
The first is currently answered by typography alone, which is a presentation
guarantee, not a check.

**Not real yet:**

- **No corpus is ingested**, so no question can be answered. The UI says so in
  place rather than failing on send. `getRfeeqCorpus()` resolves the namespace
  and its hosting row; both must exist before the chat will answer. Set
  `RFEEQ_NAMESPACE_SLUG` to pin one.
- **The six answer templates are presentation, not structure.** The model
  streams markdown, and the approved typography is applied to it. The
  prototype's hand-built blocks — the evidence table, the per-madhhab table,
  the colour-coded grade line — would need the model to emit structured output
  before they could be rendered as such.
- **The Qurʾān layers** (sūra, āya, word morphology, muṣḥaf page, «المزيد من
  التفاسير») are not built. They need the Qurʾān platforms on the allow-list,
  which are not ingested.
- **Terms and privacy policy** are placeholder rows on `/about`. The consent
  checkbox points at them.
