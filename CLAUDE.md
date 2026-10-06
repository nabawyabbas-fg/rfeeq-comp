# Rfeeq — competition instance

This is **not** the live app. It is a clone of stg taken 2026-10-05, retargeted
for **تحدي الذكاء الاصطناعي في خدمة المحتوى الإسلامي** and served at
**https://comp.rfeeq.ai**.

The live app is a separate checkout at `/home/ubuntu/app/qaf/agentset`
(stg.rfeeq.ai, port 3000, database `agentset`). Never run anything here against
that instance's database.

| | this instance | stg (live) |
| --- | --- | --- |
| Directory | `/home/ubuntu/app/comp/agentset` | `/home/ubuntu/app/qaf/agentset` |
| Origin | `https://comp.rfeeq.ai` | `https://stg.rfeeq.ai` |
| Port | **3001** | 3000 |
| Database | **`agentset_comp`** on :5433 | `agentset` on :5433 |
| Git branch | **`rfeeq-comp`** on `rfeeq-comp` = `nabawyabbas-fg/rfeeq-comp` (pushed as `main`) | `main` on `nabawyabbas-fg/rfeeq` |
| Dev log | `/home/ubuntu/app/comp/next-dev.log` | `/home/ubuntu/app/qaf/next-dev.log` |

Both can run at once. They share Postgres (different databases), the Qdrant
server, and all account-level credentials (API keys, SMTP, S3, the default
organisation id).

## Read first

`docs/competition/` holds the challenge's binding brief and everything derived
from it. Start with `docs/competition/README.md`. In short:

- `scope-and-levels.md` — the four response levels **أ/ب/ج/د** and the eight
  binding criteria, with an audit of which our prompts already enforce.
- `approved-sources.md` — the retrieval **allow-list**. A claim the system makes
  must be traceable to something on that page.
- `eval-questions.md` / `.json` — the twelve published test cases. Three are
  known to fail against current behaviour and are named there.
- `terminology.md` — approved English equivalents; sensitive terms need a
  dictionary lookup, not a translation.
- `intent-map.draft.md` — **draft only, nothing implemented.**

## The constraint that shapes the architecture

The brief has **two orthogonal axes**, and the current code has only one.

- **Intent** (quran / hadith / fiqh / …) selects *which corpus may answer*.
- **Level (أ/ب/ج/د)** selects *what may be asserted* once the material is in hand.

`ما حكم صلاة المسافر؟` and `أنا مسافر غدًا، هل أقصر الصلاة؟` have the same intent
and retrieve the same passages, but the first is level (ب) and the second is
level (د), where the system must not rule at all. Today
`apps/web/src/lib/agentic-search/corpus-prompts.ts` picks one prompt per
**namespace** — that approximates intent and has no level axis whatsoever.

إصدار الفتوى الشخصية المستقلة is **out of scope** for the challenge. That is a
limit on the speech act, not a topic ban: the system may report a ruling a
source states, never issue one for the asker's situation.

## State as of 2026-10-05

Done:
- Full clone including the then-uncommitted scoped-search, quote-panel
  (`scripture-panel.tsx`), `tool-output.ts` and corpus-catalogue work.
- Own database, migrated (`prisma migrate deploy`), with one seeded
  organisation whose id matches `DEFAULT_ORGANIZATION_ID` so signup works.
- comp.rfeeq.ai live: DNS A record, Caddy vhost, Let's Encrypt cert.
- Competition reference pack in `docs/competition/`.

Since then:
- The consumer surface at `/` is built from the approved prototype
  (`docs/competition/ui.md`).
- The two-axis classifier exists — `lib/rfeeq/intent.ts` routes intent × level
  (أ–د), with the per-level answer contracts in `lib/rfeeq/prompt.ts`, which also
  covers criteria 5–8.
- Retrieval is live against the approved platforms, not an ingested corpus:
  two publishers' **MCP servers** (`mcp.islamiccontent.org/mcp`,
  `mcp.tafsir.net/mcp`) for Qurʾān, hadith, tafsīr and the reviewed daʿwa
  material; `terminologyenc.com` direct; and a server-side domain-locked web
  search for the platforms with no API. See `docs/competition/retrieval.md`.

- All four of the brief's scope exclusions are now guarded, not just personal
  fatwā: `routing.exclusion` in `lib/rfeeq/intent.ts` covers الحكم على الأشخاص
  والجماعات، النزاعات الخاصة، and الوقائع غير المتحققة, each with its own
  contract in `prompt.ts` and its own reader notice. See
  `docs/competition/scope-and-levels.md`.
- The brief's ten sensitive terms carry their ضوابط into the prompt per
  question — `lib/rfeeq/terms.ts`, injected only on the turns that trigger them.
- `terminology` can search موسوعة الجمهرة, and `fiqh` can read رسالة الحرمين.

- **All twelve eval cases verified live**: 8 pass / 3 partial / 1 fail on the
  first run (5 Oct), 12/12 after four fixes, and **12/12 again after the v1.10
  sync** (6 Oct) with no regressions. Results and the defects are in
  `docs/competition/eval-questions.md`; the six templated cases carry our own
  instantiations in the JSON's `probe` field.
- **Follow-up suggestions are stored on the message, not regenerated.**
  `message.metadata.followUps`, written once by `use-follow-ups.ts` and saved
  with the conversation. They are a property of an answer — the same answer
  yields the same next questions — and they render under *every* answer in a
  thread, so reopening a ten-turn conversation used to fire ten requests each
  time. Three layers had to agree: the metadata type, the client save signature
  (which counts follow-ups across the whole list, since an answer part-way up
  can acquire a set), and `saveIsNoOp`, which compares **every** row's metadata
  rather than only the last row's.
- **The open conversation is in the URL** — `/c/<id>`, via
  `shell/use-chat-url.ts`. **The path, not a query parameter**:
  `app/(rfeeq)/c/[chatId]/page.tsx` already existed and already worked, passing
  `initialChatId` to `useLoadChat`. A `?c=<id>` on `/` looked the same in the
  address bar and was not the same thing — `/` renders the chat with no id, so a
  reload landed on an empty chat whatever the URL said. Written with
  `history.pushState`, not `router.push`: the conversation is already in the
  store, so re-rendering the route would refetch and replace what is on screen;
  on a *reload* the route does the work, which is the division this relies on.
  Three rules carry it: `null → id` is a conversation acquiring a record on its
  first save and must **replace**, not push, or Back lands on the same
  conversation a moment before it had an id; the popstate handler sets its ref
  **before** acting, or the write-back reads Back as navigation and Back walks
  forward; and `goToChat` must treat `/c/…` as the chat surface, or opening a
  conversation from the rail navigates to `/` and empties the chat first.
- **The opening suggestions are written, not fixed** —
  `lib/rfeeq/starters.ts` + `/api/rfeeq-starters`, cached ten minutes across
  visitors. The chip's icon comes from `routeQuestion`, never the model, and a
  suggestion the system would refuse is dropped — including **a hadith question
  naming only its narrator** («تحقّق من حديث عائشة»: she narrated over two
  thousand, so there is nothing to look up), checked for a quoted matn the way a
  verse is checked against the sūra table; the curated trio renders
  instantly and stays if generation fails.
- **Synced to the approved prototype v1.10** (6 Oct 2026): the answer type
  scale and vertical rhythm, the revised section order (commentary first, ruling
  split in two, hadith led by its grading), the «مصدر موثّق» tag, the quieter
  grade badge and citation chip, and the panel rebuild — resizable, science
  cards, āya/word tabs, tables, sources opening in place. See
  `docs/competition/templates.md`.
- **A matn is set in خط عثمان طه, at 16 on a leading of 2.** This reverses
  v1.10's «Asked-about hadith: answer-body font, not the Quran font» at the
  owner's instruction (6 Oct). What still keeps the recited word apart from a
  narrated one is the brackets and the leading — a verse is ﴿ ﴾ in Scheherazade
  (`font-rf-quran`) at **24 on a 50px leading**, a matn is « » in
  `font-rf-matn` at **22 on a leading of 2**.
  Both faces are now **KFGQPC Uthmanic Script HAFS** — خط عثمان طه — self-hosted
  from `public/fonts` because no CDN carries it: `--font-rf-quran` for every
  āya display and `--font-rf-matn` for a narration, with Scheherazade behind
  both. Three things about it:
  - It ships **byte for byte as published** — its licence grants Use, Copy and
    Distribute free of cost but forbids modification, so it is deliberately not
    subsetted, not re-compressed and not converted to WOFF2. 246 KB of OTF is
    the price of shipping it lawfully; the licence travels beside the file.
  - **It has no bold.** `usWeightClass: 400` and KFGQPC publishes no bold cut.
    `font-weight: bold` would make the browser draw each glyph twice at an
    offset, which on a naskh carrying tashkīl runs the diacritics into the
    letters beneath. The `.rf-matn` utility thickens every contour by the same
    hairline instead (`--rf-matn-weight`, 0.3px ≈ a semibold at 16px) and sets
    `font-synthesis-weight: none` so no browser smears it either way. Set the
    token to 0 for the face exactly as drawn.
  - Its cmap claims the whole Arabic block, but **172 of those 256 entries point
    at one placeholder outline** 1442 units wide (an alef is 360): every
    Persian/Urdu/Sindhi letter, the extended digits, the honorific signs, and
    «،» «؛» «؟» — which is how a comma came out as a large wrong mark. The
    `unicode-range` on the face admits only the 99 codepoints it actually draws,
    measured from `glyf`, and everything else falls through per glyph. Selecting
    the font is not modifying it, which is what rules subsetting out. Every
    Uthmanic mark a verse needs is inside that range, ۝ (U+06DD) included.
  - **Three faces, and only two texts have a hand of their own.** A verse takes
    `font-rf-quran`, a matn `font-rf-matn`, and **everything else** — dorar
    pages, library articles, terminology entries, the answer's own prose — takes
    `font-rf-ui`, which is IBM Plex Sans Arabic. `sources.tsx` is where this is
    easiest to get wrong: one component renders every kind of retrieved
    passage, and a two-way branch there sent everything that was not a verse to
    the muṣḥaf hand, dressing a scraped article as scripture.
    `test/rfeeq-quran-face.test.ts` holds the three-way split, and scans every
    call site for a weight the Qurʾān face does not have.
- **`src/proxy.ts` must exclude any new static directory.** Its matcher sends
  everything it does not exclude through the multi-tenant host lookup, so
  `/fonts/…` came back as the 404 HTML page and the browser discarded it as an
  unparseable face. `icons/` was already excluded; `fonts/` now is too. A
  matcher change needs a dev-server restart — Fast Refresh will not pick it up.
- **The اللغة العربية template is built** — a `language` intent, placed *below*
  the subject rules so a word that already belongs to a domain keeps it. Its
  الاستعمال القرآني section is built from the concordance via `mcp/lexicon.ts`,
  which walks word → āya → `analyze_word` → مادة → root stats, because nothing
  maps a bare word to its root.
- **The reader's level is a real axis** — `lib/rfeeq/expertise.ts`. عامّ is
  **answered from التفسير الميسر alone**: both editions woven into one answer
  put «(التفسير الميسر)» and «(المختصر في التفسير)» on the same sentence, the
  same meaning twice. المختصر is not dropped — the علوم الآية pane still lists
  it — so `answerEditionsFor` (what the answer is written from) and
  `tafsirEditionsFor` (what the pane shows) are deliberately different lists.
  The section is headed **«المعنى الإجمالي»**, naming what it is rather than
  which book it came from, and it opens with the meaning itself — «جاء في
  التفسير الميسر:» as a lead delayed the answer by a line to repeat what the
  «مصدر موثّق» tag already says. The specialist set is untouched: four
  commentaries side by side is the point of that level. **The علوم الآية pane
  lists all six editions whoever is reading** (`ALL_TAFSIR_EDITIONS`): the level
  scopes what the *answer* rests on, and scoping a reference the reader opened
  on purpose left a non-specialist with no way to reach الطبري at all. عامّ reads الفصحى البيضاء; متخصّص reads الطبري وابن كثير
  والبغوي والسعدي مع ذكر الطبعة. The two sets are disjoint, the answer and the
  side pane read the same axis, and `fetchTafsir` now **requires** `sources` —
  the old default served the specialist set to everyone.
- **A qirāʾa names the word it belongs to.** The block read «الكلمة ٤» over
  four readings describing a word the reader could not see. `word_no` indexes
  مركز تفسير's tokenisation while splitting the āya is ours, so the split is
  **checked against the `word_count` the centre reports** and dropped entirely
  when they disagree — a qirāʾa attached to the wrong word is a claim about the
  Qurʾān the source did not make. The pointed text is preferred: `fetch_ayah`
  returns the āya stripped («كفوا»), while the document already fetched for the
  translation carries the muṣḥaf's «كُفُوًا».
- **The Qurʾān side panes are built** — tapping the sūra name opens مقدمات
  السورة, the āya number opens علوم الآية (أسباب النزول، ٦ تفاسير، إعراب، تجويد،
  قراءات), and any word of a verse opens علوم الكلمة. Fetched on open via
  `/api/rfeeq-sciences`, every block folded as the spec requires.
- **الدرر السنية is read for every hadith, not when the model remembers to.**
  `sources/dorar.ts` runs with `read_sources`: موسوعة الحديث answers with one
  grading and one attribution, so the model never had a reason to ask further
  and never did — the conversation that surfaced this called `hadith_search`
  and `read_sources` and nothing else. Dorar's own CDN refuses this server
  (Cloudflare 403 on every path, browser agent or not, so its published JSON
  endpoint at `dorar.net/article/389` is closed too), so it is reached through
  the approved web search, which `WEB_DOMAINS.hadith` already allowed. It
  supplies **الراوي**, which nothing else did — the reference row had asked for
  one since it was written — and **أحكام المحدّثين**. The pages it reads are
  **returned with the hadith**, not just mined for metadata: they were being
  read and discarded, so المصادر listed only موسوعة الحديث while the answer's
  gradings leaned on الدرر السنية. A page that yields no ruling is still dropped
  — found but not citable is not a source. Its rulings are also: «من حسن إسلام المرء»
  comes back with eleven rulings that disagree (حسن from النووي، مرسل from
  البيهقي، ضعيف from ابن عدي). The parser takes **only Dorar's verbatim ruling
  blocks**: the search returns its own summarising prose alongside them with the
  same labels and colons, and the discriminator is that Dorar writes `label`
  space `:` space `value` while prose writes `label:`. It fails toward fewer
  rulings on a format change, never toward invented ones.
- **A quotation opens the pane for what it quotes, never an enlargement.** A
  matn opens تفاصيل الحديث, a verse opens علوم الآية, and the old popup is only
  what is left when a quotation matches nothing retrieved — the same words,
  larger, which is all it ever offered. Every Qurʾānic scripture section runs
  through `VerseRun` now, one verse or several, so a single verse carries its
  numbered mark too and can reach its own pane even when each of its words is a
  control.
- **Every quoted hadith opens its own تفاصيل الحديث.** An inline «…» quotation
  reaches the renderer as text and nothing else — `markScriptureQuotes` is a
  pass over the answer's prose, so it carries no chunk id — so the quote is
  matched to its report on the normalised matn (`hadithQuoted` in `sources.tsx`,
  using `normaliseArabic`, the same basis as `isQuoteSupported`). A needle under
  12 characters is refused: «قال رسول» occurs in every matn retrieved and would
  open whichever was first. The link at the foot now appears **only when the
  answer has one hadith**, counted by matn — one report arrives as several
  chunks, موسوعة الحديث's record plus the Dorar pages ruling on it — because
  with four reports on screen a single link naming none of them is worse than
  none.
- **تفاصيل الحديث is a side pane** — `components/rfeeq/chat/hadith-panel.tsx`,
  opened by the **«تفاصيل الحديث» link last before «المصادر»** — where the
  answer's other exits live, beside «ترجمة الآية» — and by the matn itself. On
  a hadith the matn no longer enlarges; the pane opens with the matn at its
  head, so nothing the enlargement gave is lost. The link is not gated on the
  template: a fiqh answer turning on a hadith gets it too.
- **The āya is not listed among the answer's sources.** It is what the answer is
  *about*, shown in full already with its sūra and number and علوم الآية a tap
  away; a «Qur'an 9:15 · موسوعة القرآن» row under that pushes the commentaries —
  the real sources — down the list. Filtered in `RfeeqSourcesProvider`, never in
  `components/chat/sources-panel.tsx`, which the Agentset playground shares. The
  filter applies to the *list* only: `chunks` is still built from everything
  retrieved, because the scripture section renders the verse **from its chunk**
  and dropping it would fall the section back to the model's own prose.
- **A proof stands under the claim it proves, and has nowhere else to go.** A
  prose section carries `<ev>` markers inline and they render where written;
  adjacent ones group into one block, so the قرآن ← سنة ← إجماع ← قياس order and
  the two-proof table threshold scope to a point's own proofs. «الأدلة» as one
  folded block at the foot of a ruling put the verse establishing the time of
  الإمساك four screens below the sentence it establishes.
  **The standalone `evidence` and `khilaf` sections are gone** from both `fatwa`
  and `general` — asking the model to prefer inline placement did not work (it
  put all four proofs in the section anyway), so the section was removed and the
  only remaining place is beside the claim. A disagreement goes under its point
  led by «**اختلاف العلماء:**» — plain prose, so no new marker had to survive
  `citesNothing`, `markUncitedParagraphs` and the language gate.
- **A `ref` may name several chunks, comma separated**, and more than one verse
  renders as a muṣḥaf run — one ﴿ ﴾ around the passage, every āya closed by its
  **U+06DD numbered mark**, which is the control that opens علوم الآية for it.
  **The numeral is overlaid on the circle, not written after it**: the font's
  GSUB carries 56 lookups and *none* ligates U+06DD with a digit, so «۝٤»
  renders as an empty circle with a 4 beside it. Its digits are drawn for the
  job all the same (١ is 0.27em against the circle's 0.89em), so they are the
  muṣḥaf's own numerals placed where the font cannot place them — two children
  of one `inline-grid` cell. The reference line under a passage states
  «الآيات ١–٤» as text rather than linking the first of four; a single verse
  keeps its link, having no mark to stand in for it. It
  replaced a stack of separately-bracketed centred lines (a sūra set as four
  quotations) plus a row of «الآية ١ · الآية ٢» links that duplicated the
  reference line directly beneath it. A sūra of fewer
  than ten āyāt is shown whole — «تفسير سورة الإخلاص» already retrieved all four
  (`quran_verse` takes `throughAya`) and displayed one, because the section
  rendered whatever single id the ref named. Tapping a verse opens علوم الآية,
  the same destination as its link; word buttons inside stop their own clicks so
  the finer target still wins. «ترجمة الآية» is gone from the answer — the
  translation lives in the āya pane, which tapping the verse now opens.
- **Evidence is typed.** One `<ev t=… by=… why=… src=… ids=…>` marker per
  proof; the order (قرآن ← سنة ← إجماع ← قياس), the two-proof table threshold
  and the per-type colours are decided in `lib/rfeeq/evidence.ts`, not by the
  model. On `fatwa` **and** `general` — the spec says «في أي مجال وليس في الفقه
  وحده».
- **The answer templates are a rendering contract now, not just a
  classification.** Ordered named sections per template with a declared fold
  state, the folds opening when the question asked for them, and the verse,
  reference row and grading rendered from the retrieved chunk rather than
  retyped by the model. See `docs/competition/templates.md`.

Not done — this is where to pick up. Full gap analysis:
https://claude.ai/code/artifact/8ca5cf85-d4f8-4997-8938-e6fc8ff05270
- **الإسناد نفسه** — the chain, narrator by narrator. الدرر السنية is now read
  for every hadith (above), which brings الجرح والتعديل as the muḥaddiths
  themselves stated it — «فيه محمد بن كثير بن مروان وهو ضعيف» — but a *chain*,
  each narrator with their standing, is not a field any approved source
  publishes. Building that would still mean a model summarising an isnād.
- **Recitation** (الكلمة · الآية · الصفحة). `get_quran_audio` is wired-ready on
  the encyclopedia server; what is missing is a player.
- **Only 7 of the 28 MCP tools are wired.** `analyze_word`, `get_root_stats`,
  `get_surah_statistics`, `get_quran_audio`, `get_qeraat_variants` and the rest
  return exactly what the template spec asks for and are already connected.
- **Nothing is ingested, and that is now a decision rather than a gap.** There is
  no namespace and no corpus; the semantic work an index would do happens in
  query understanding. `retrieval.md` records what that costs and what an
  ingested path would need.
- Open questions 1, 2 and 4 in `docs/competition/intent-map.draft.md`.
- `packages/demo` still seeds example namespaces from `assets.agentset.ai`. It
  is live code with five call sites, so the demo feature wants removing rather
  than its URLs rewriting.

**Transactional email is Rfeeq throughout** — `packages/emails/src` plus the two
Stripe senders (`stripe/webhook/utils.ts`, `checkout-session-completed.ts`) and
the invoice line in `billing.ts`. All ten templates render with no «Agentset»
and no remote image; the wordmark is text, so nothing depends on a CDN that is
not ours and nothing breaks in the clients that block images by default. Two of
them were **signed by name and title by a founder of the upstream project** —
the welcome, upgrade and cancellation letters. Renaming the
company while keeping the signature would have attributed a personal letter to
someone who did not write it, which is worse than the branding leak, so those
are signed «فريق رفيق». The footer reads «رفيق · rfeeq.ai» rather than inventing
a legal entity. `@agentset/*` package names, `AgentsetApiError` and the
`Agentset-Signature` webhook header stay: those are internal identifiers and a
wire contract, not text a reader sees.

**The tab icon is رفيق**, drawn from `components/rfeeq/logo.tsx`'s own paths so
it cannot drift from the wordmark. Two cuts, because one does not survive both
ends: the full wordmark is legible from 32px up and turns to mush at 16, where a
single **ر** keeps a clean silhouette — the `sizes` hints in `lib/metadata.ts`
are what let the browser choose between them, and the 16 entry is different art,
not a smaller copy. An SVG is declared first and sizeless so a browser that
supports one scales it crisply; `favicon.ico` carries both raster sizes and is
found by convention. Sources are `public/icons/rfeeq-mark{,-sm}.svg`; the PNGs
and the ICO are generated from them with `sharp`.

The upstream Agentset provenance has been removed — remotes, its docs site, its
GitHub templates, and every reference to its repo and product URLs.
**`LICENSE.md` stays on purpose**: the code is MIT, which requires the copyright
notice be retained in copies, so deleting it would be a licence violation rather
than a rebrand. The `@agentset/*` workspace package names and the
`app.agentset.ai` route directory are internal identifiers and were left alone.

## Gotchas that have already cost time

- **`normaliseArabic` folds the Qurʾānic annotation marks.** They used to
  survive the tashkīl pass and hit the catch-all, which turns anything
  unrecognised into a **space** — «بِٱلۡحِكۡمَةِ» became «بال حك مه», three words
  where the source has one, so a correctly quoted verse stopped matching the
  plain-script writing of itself. Removing rather than spacing them can only
  make more quotations match, never fewer, which is the safe direction for a
  check whose failure mode is flagging sound text.

- **The quotation delimiter does not settle the kind.** «…» is the hadith's and
  ﴿ ﴾ the Qurʾān's, but غريب القرآن quotes **Qurʾānic words** in guillemets —
  that is how the centre writes a headword — so «وَلَا يَـُٔودُهُۥ» was marked
  as a matn, set in the hadith face, and offered the reader أحكام المحدّثين for
  a word of آية الكرسي. `markScriptureQuotes` now falls back to the **script**:
  ʿUthmānī carries alef wasla, superscript alef, the Qurʾānic annotation signs
  and the open tanwīn forms, and the hadith encyclopedias vocalise in standard
  tashkīl which shares none of them. Measured over everything this app has
  retrieved: 73/73 Qurʾānic passages carry one, 0/33 hadith passages do. Note
  `QUOTE` needs twelve characters inside « », so the shortest headwords are
  never wrapped at all.

- **No template-fallback banner.** When a template's sections do not build, the
  answer renders as the general shape and says nothing about it. There used to
  be a note — «لم تتوفّر بيانات كافية لعرض الإجابة بقالب …» — on the reasoning
  that a silent degrade looks identical to never having needed the structure. It
  fired on answers that read perfectly well, and a banner calling an answer
  deficient above an answer that is not costs more trust than it protects.
  `TEMPLATE_LABEL` existed only to name the template in that sentence and went
  with it.

- **A template section with nothing retrieved behind it is simply never
  written** — correctly, but silently. «غريب القرآن» and «من فوائد الآيات» are
  declared in the tafsir template and never appeared in an answer, because
  `fetch_tafsir` returns commentary alone. Both come off `fetch_ayah`:
  `include: ["gharib", "tadabbur"]` — `tadabbur` being هدايات القرآن (مصحف
  التدبر), the centre's name for the «فوائد» material. When a declared section
  never shows, check what the tool actually returns before touching the prompt.
- **`fetch_surah_info.names` holds exactly one name.** For البقرة it is
  `["البقرة"]`, so «أسماء السورة» showed a single name for every sūra. The rest
  are in `names_info` on `get_surah_statistics` — a long essay whose opening
  summary lists them under أسماؤها التوقيفية / الاجتهادية. `surahNames` reads
  only that summary (it ends at the first line starting with `*`); parsing the
  essay would mean judging which sentences name the sūra and which discuss a
  name.
- **`dir="auto"` on a figure resolves per value.** A bare number is
  direction-neutral so it came out left-aligned, while «الطوال» came out
  right-aligned — half the statistics grid against one edge, half against the
  other, nothing lined up with its own label. Keep the container's direction and
  use `[unicode-bidi:isolate]` so a number cannot reorder against its
  neighbours without also setting the alignment.

- **A grading only renders as a badge when a *chunk* carries it.** The «درجة
  الحديث» section renders from `metadata.grade`; with none, it falls back to the
  model's prose and the word «حسن» appears as ordinary text, uncoloured — which
  is what happened to every hadith موسوعة الحديث does not hold, since a Dorar
  page is a web result with no grading field. `fetchDorarHadith` now attaches
  the page's own verdict, **but only when that page's rulings agree in tone**: a
  single badge over a matn النووي called حسن and ابن عدي called ضعيف would be
  the interface taking a side the sources have not. A disputed grading stays
  prose, with the detail in أحكام المحدّثين.

- **A web-search excerpt is the model's turn, not the page's text.** The search
  returns one turn containing both the verbatim quotation *and* the narration
  framing it, and the excerpt was everything up to the citation marker — so a
  source card read «2. من صفحة الموسوعة الحديثية الخاصة بابن باز: "إذا أفطر
  أحدُكم…"», printing generated prose as retrieved text. The instructions now ask
  for `<q> … </q>` around each quotation and `quotedOnly` keeps only that.
  **Not quotation marks**: Arabic quotation nests, so a citation's outer `"`
  closes on the matn's inner `»` and the extract stops mid-sentence. It falls
  back to the whole span when the tag is missing, and such a chunk still carries
  `metadata.extracted`. Consequence worth knowing: one Dorar ruling block can
  now arrive as several excerpts, so `fetchDorarHadith` parses **per page**
  (grouped by `documentId`) — per excerpt it loses every split ruling, and
  joined wholesale it would pair one page's narrator with another's verdict.

- **The sources panel holds a snapshot, so it must be closed on a chat switch.**
  Its state keeps one answer's sources and that answer's id; loading another
  conversation replaces every message but left the panel untouched, so a hadith
  answer sat beside «المصادر (3)» listing the tafsīrs from the verse question
  read before it. `RfeeqSourcesHost` now watches `useActiveChat().chatId` —
  **not** the messages, which change on every streamed token under a component
  that wraps the whole thread. Two details: a `null → id` transition is this
  conversation acquiring a record on its first save, not a switch, so it must
  not close; and the adjustment is made **during render** (`if (seen !== chatId)
  setSeen(...)`) rather than in an effect, because `react-hooks/set-state-in-effect`
  rejects the effect form — and rightly, since rendering once with the previous
  conversation's sources is the bug itself.

- **﴿ ﴾ are a different face from the verse, so their alignment is arithmetic.**
  Amiri Quran's ornate parenthesis spans em[-0.416, +0.746]; KFGQPC Uthmanic's
  letters span em[-0.443, +0.683]. At **1em** the bracket is therefore already
  the right height (1.162 vs 1.126em) and the entire error is that its centre
  sits **0.045em** too high — hence `text-[1em] [vertical-align:-0.045em]`. What
  it replaced was `text-[24px]` with `align-middle`: a fixed size 1.5× the text
  it enclosed, and a vertical-align keyed to the parent's x-height, which Arabic
  does not really have. Two further traps: `em` resolves against the **parent**,
  so the size must sit on the quote's wrapper or the brackets measure themselves
  against the surrounding 16px prose; and `vertical-align` with a length is
  measured from the baseline, the one line two faces agree on.
  `test/rfeeq-quran-face.test.ts` holds all of it.

- **Tailwind's preflight sets `svg { display: block }`.** An `Icon` in a plain
  block container therefore takes a line of its own — which is how a collapsed
  section's fold chevron came to sit *under* «أحكام المحدّثين» instead of beside
  it. Nothing else showed it because every other Icon sits in a flex row, where
  a block child is blockified anyway. Layout like that belongs on the element
  (`<summary className="flex items-center gap-2">`), not in `ANSWER_PROSE`: a
  section is rendered by both the answer body and the shared-answer view, and a
  heading that only holds together in one of them will break in the other.

- **Opening a conversation used to rewrite it.** Loading one puts its messages
  into client state with the run already finished — the exact shape
  `use-chat-persistence.ts` saves — so the rail sorted by *last opened* while
  sorting on `updatedAt desc`. The guard is server-side (`saveIsNoOp` in
  `lib/chat-save.ts`, applied in `api/chats` POST) because the client cannot be
  sure of its own ordering: the messages and the chat id come from two different
  stores, and when the messages land a render later the hook has already
  recorded an empty conversation as saved. A late-arriving `metadata.metrics`
  counts as a change, or half the turns lose their cost and latency.
- **`lib/chat-history.ts` cannot be imported from a test.** It reaches the
  database and the session and so `@/env`, whose extended schemas (Stripe,
  Pinecone, storage) fail to validate under vitest. Pure helpers worth testing
  go in a leaf module — `lib/chat-save.ts` is one.

- **Qdrant is shared with the live app.** Collections are `as_<namespaceId>`.
  Create competition corpora as **new** namespaces; re-ingesting into an
  inherited one would change vectors the live app reads.
- **`prisma generate` requires a dev-server restart.** Fast Refresh keeps the
  old client in memory, so a new column or enum value is rejected at runtime
  while the schema on disk clearly has it. It surfaces as an opaque 500.
- **Never `sed -i` the Caddyfile** at `/home/ubuntu/app/sohba/deploy/Caddyfile`.
  It is bind-mounted into `adkar-caddy`; `sed -i` writes a new inode, so the
  container keeps serving the old config while `caddy reload` reports success.
  Append or edit in place, verify the inode is unchanged, then reload.
- **Testing on an insecure origin breaks web APIs.** Over `http://IP:3001`,
  `crypto.randomUUID` and `navigator.clipboard` are undefined. Test on
  https://comp.rfeeq.ai.
- The Arabic normaliser in `apps/web/src/lib/verify-quotes.ts` expects an
  **already-normalised** haystack — `collectSourceText` does that. Passing raw
  text flags every correct quote as unverified.
- **Intent patterns must be written in normalised form.** `normalise` in
  `lib/rfeeq/intent.ts` folds «ى»→«ي» and «ة»→«ه», so a term spelled «معنى» can
  never match: the input says «معني» by the time the pattern runs. Six terms were
  dead that way. `words()`, `opener()` and `pattern()` now fold their own terms,
  so write Arabic normally — but never hand-build a `new RegExp` there.
- **An MCP tool result can carry one text part per row.** `search_quran_text`
  returns the whole set in `structuredContent` and one text part per hit; reading
  only the first part looks like an empty result. `callMcpTool` returns every
  part in `texts`, and callers prefer `structuredContent` when it is there.
- **`fetch_tafsir` rejects the whole call on one unknown slug.** `'mukhtasar' is
  not a valid TafsirSource` — the correct slug is `mukhtasar_ar` — and because
  the fetchers are deliberately soft, a single typo emptied the entire التفاسير
  block silently instead of degrading it. Check `list_tafsir_sources` before
  editing `PANEL_TAFSIRS`.
- **`analyze_word` returns `root: null` for every word**, and states the root in
  its ṣarf field as «مِنْ مَادَّةِ: (أله)». `rootFromSarf` reads it from there —
  after stripping diacritics, since «مَادَّةِ» carries three of them and the
  first pattern matched nothing.
- **A structural section's `ref` must be an encyclopedia chunk, never a web
  result.** `kindOf` used to default to `"quran"`, so a dorar search result
  named as the matn was dressed in ﴿ ﴾ at Qurʾānic reading size — a scraped page
  presented as scripture. It now reads the kind and falls back to the model's
  own prose when the chunk is not a passage; the format instruction tells the
  model to leave `ref` empty and write the text in the section instead.
- **A React element is truthy even when the component returns null.** That is
  how «الدرجة» printed as a heading over nothing: the section asked "is there
  content?" of an element, not of the data. Structural sections now test the
  field before building the element.
- **A bare `grid gap-*` is an overflow waiting to happen.** With no declared
  columns a grid gets one *auto* track, sized to its items' **max-content** — so
  the longest untruncated string inside sets the width and the container
  overflows. It widened the history rail once, then the sources pane (every
  card pushed past the panel by «التفسير الميسر، مجمع الملك فهد لطباعة المصحف
  الشريف»), where the titles already carried `truncate` and never got the
  chance. Always `grid grid-cols-1`, which is `minmax(0, 1fr)` — that `0` floor
  is the whole reason Tailwind writes `grid-cols-*` that way. All 19 in
  `components/rfeeq/chat` are fixed and `test/rfeeq-sources-panel.test.tsx`
  keeps them so.
- **`cn()` is tailwind-merge, and it cannot tell `text-rf-quran-sm` from
  `text-rf-text`.** Both are bare custom `text-*` utilities it has no config
  for, so it treats them as one group and keeps the last — silently dropping the
  font size. It bit the per-word verse buttons, which then rendered at the
  browser's button size. Arbitrary values are safe (`text-[15px]` beside
  `text-rf-success` is fine); two *named* `text-` tokens in one `cn()` are not.
  Use a plain string there.
- **`ANSWER_PROSE` outranks utilities on the element.** `[&_p]:my-0` is a
  descendant selector, so `my-3` on a `<p>` inside the answer body does nothing.
  Use a `div`, or a `span` with `block` — which is also what a quote-panel
  `button` needs, since `button` permits phrasing content only and a `<p>`
  inside one is invalid.
- **The language gate judges the first 180 characters, so markup counts.** It
  now strips tags first (`prose()` in `agentic-search/language.ts`) — before
  that, the templates' Latin `<part k="…" ref="…">` markers made every hadith
  answer look English, so it was discarded and regenerated. A new marker syntax
  in an answer must be invisible to that counter.
- **Anything appended to the answer's markup has to pass three whole-text
  passes**: `citesNothing`, `markUncitedParagraphs` and the language gate all
  read the raw stream. A section `ref` counts as an attribution and a section
  marker is not a claim; both needed saying explicitly.
- **MCP never reaches the reader.** Citations are labelled by publisher
  (`CORPUS_LABELS` in `components/chat/citation-modal.tsx`) and the waiting line
  names the source being read (`ACTIVITY` in `components/rfeeq/chat/thread.tsx`).
  A new `metadata.source` key needs an entry in the former or it shows up
  title-cased and raw.

## Commands

```bash
bun dev:web        # :3001, port comes from PORT in .env
bun typecheck      # two pre-existing errors are expected:
                   #   scripts/populate-document-namespace-id.ts
                   #   src/components/chat/message-actions/logs.tsx  ("txt")
bun db:migrate     # against agentset_comp — check DATABASE_URL first
bun db:generate    # then RESTART the dev server
```

**This instance runs a production build, not `next dev`.** No dev indicator, no
error overlay, pre-rendered pages — and **no hot reload**: a code change reaches
comp.rfeeq.ai only after a rebuild and a restart.

```bash
cd /home/ubuntu/app/comp/agentset/apps/web
bun run build                      # ~2 min; log at ../../next-build.log
pkill -f "next-server" ...         # ONLY the /comp/ pids — check cwd first
setsid nohup bun --env-file=../../.env run next start \
  >> /home/ubuntu/app/comp/next-prod.log 2>&1 < /dev/null & disown
```

To go back to hot reload for a working session, swap `next start` for `next dev`
and log to `next-dev.log`.

**Build it with the dev server stopped.** After a long session the dev
`next-server` had grown to **7.1 GB**, and with both instances' servers up the
box was at 14/14 GB with 25 GB of swap in use — the build thrashed and made no
progress until that process was killed. Check `free -h` before building.

Check which instance owns a port before killing anything — `pgrep -f "next dev"`
matches both checkouts, and the live app is the one under `/home/ubuntu/app/qaf/`.

See `COMPETITION.md` for deployment details.
