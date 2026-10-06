# Retrieval from the approved sources

How the system reaches the challenge's allow-list, why it does so by calling the
platforms rather than by searching the web, and what that does and does not
cover today.

## The constraint this is built around

`approved-sources.md` states it in one sentence:

> A claim the system makes must be traceable to something on this page; material
> outside it may not be used as evidence, however reliable it looks.

That is not a preference a prompt can keep. A model told to "search only
approved sites" will comply nearly always, and the one time it does not there is
no record and no way to prove otherwise. So the rule lives at the only place it
can be enforced — the function that opens the socket.

`lib/rfeeq/sources/allowlist.ts` holds the approved hosts.
`lib/rfeeq/sources/client.ts` is the only way out to the network, and it calls
`assertAllowed` before the request. A host that is not listed throws before any
bytes leave. The host is matched **exactly**, not by suffix, because
`endsWith("quranenc.com")` also admits `quranenc.com.attacker.example`; plain
http is refused too, since scripture rewritten in transit is the one corruption
this system must not pass on quietly. All of that is tested in
`test/rfeeq-sources.test.ts` as a boundary, not as a helper.

## Web search, measured

Two web-search mechanisms were tested against the one requirement that matters:
can the allow-list be enforced?

### Gemini grounding: no

`googleSearch` grounding cannot be pointed at an approved source. Asked, in
Arabic, to search only `dorar.net`, the queries it issued carried **no `site:`
operator at all**; it grounded on `fikhguide.com`, `islamweb.net` and
**`youtube.com`**; and it returned **zero** results from dorar.net — while
producing a confident madhhab-by-madhhab answer resting entirely on off-list
sources. Repeated with the strongest instruction the API allows (_"You MUST
issue the search query exactly as `site:dorar.net …`"_), the operator was
stripped again.

The neighbouring **wosoul** project reached the same conclusion independently;
its Gemini provider says so in its own docstring, and works around it by
resolving each grounding redirect and keeping only the dorar ones — "which can
be sparse".

### OpenAI `web_search` with `allowed_domains`: yes

OpenAI's web search accepts `filters.allowed_domains` and **enforces it
server-side**. The search action reports `domains: null`, meaning the
restriction never passes through the query for a model to rewrite. Measured:

| Locked to              | Hosts actually cited              |
| ---------------------- | --------------------------------- |
| `dorar.net`            | dorar.net ×14                     |
| the six fiqh domains   | dorar.net ×6, islamqa.info ×7     |
| the three dawa domains | dawa.center ×2, islamhouse.com ×9 |

Nothing off-list, across every run. This is what covers `fiqh`, `aqida`,
`sira-history`, `shubuhat` and `dawa` — the domains whose approved sources
publish no usable API. It is also how `dorar.net` is reached at all, since its
CDN blocks this server directly.

`lib/rfeeq/sources/web-search.ts` implements it, and `citationAllowed` re-checks
every returned citation against the lock: the server-side filter is the control,
the re-check is the audit, and a citation from outside it aborts the search
rather than narrowing it silently.

### Query understanding, since nothing is ingested

A vector index absorbs the gap between how a reader asks and how a book is
written. With live search there is no index, so that gap closes in the query
instead — and the work moves to a stage before the search rather than being
skipped.

Shape is the point, not paraphrase. The approved domains index in two different
ways:

- `dorar.net`'s موسوعة فقهية and `shamela.ws` are organised by bāb and masʾala,
  so a chapter heading retrieves where a question does not.
- `islamqa.info`, `binbaz.org.sa` and `binothaimeen.net` publish one question
  per page, titled the way the questioner put it — the opposite.

`lib/rfeeq/sources/query-expansion.ts` rewrites a question into four shapes —
`masala`, `fatwa`, `technical`, `evidence` — and keeps the reader's own wording
as a fifth. The rewrites are a bet that the sources phrase it differently; the
original is the hedge, and it costs one search. The vocabulary mapping is the
one the corpus prompts already carry: a reader's «الرهن العقاري» becomes
«الإجارة المنتهية بالتمليك والمرابحة للآمر بالشراء», and an English question
becomes Arabic — measured, not hoped for.

The five run concurrently, and results are deduped on page _and_ passage, then
**interleaved** before the cap. Concatenating instead spends every slot on the
first phrasing, which throws away the reason for searching several ways at all.

Measured on «ما حكم الجمع بين الصلاتين في السفر؟», locked to the five fiqh
domains:

|             | hosts reached | passages |
| ----------- | ------------- | -------- |
| one query   | 2             | 4        |
| five shapes | 3–4           | 12       |

— in 7.8s wall clock, since the searches are concurrent. Each chunk records the
phrasing that found it (`metadata.foundBy`), so a thin result can be traced to
what was actually tried, and a search that finds nothing reports the phrasings
it tried rather than a bare silence.

### What this kind of result is, and is not

The APIs return **records** — a hadith with its grading, a verse in its
canonical orthography. A web search returns the model's **extraction** from a
page it opened. The link is real (taken from the citation annotations, never
from text the model wrote) and the domain is enforced, but the passage is a
rendering rather than a record. Chunks from here carry `metadata.extracted` so
that difference stays legible.

Two details that took measuring:

- **Passages are anchored to citation offsets**, not to any format the model was
  asked for. It follows a `### title` / `> quote` instruction perhaps half the
  time; the `start_index` / `end_index` on each annotation are always there. The
  annotated span is the inline link markup, so the passage is the text
  _preceding_ it, bounded to a paragraph. This is the technique wosoul arrived
  at for the same reason.
- **`output_text` does not exist on the REST response.** It is a convenience the
  OpenAI SDK computes client-side. Reading it over HTTP yields undefined, every
  citation offset then points past the end of an empty string, and the search
  returns nothing at all — silently.

### `urlContext`

A third option, worth recording. The caller supplies the URL, so the allow-list
is enforceable, and Google's fetcher reads `dorar.net/feqhia/1234` and
`/aqeeda/100` where this server gets a 403. But its search pages, JSON API,
sitemap and robots.txt are all refused through the fetcher too — so a Dorar page
can be _read_ once its id is known and cannot be _found_. An enrichment step,
not a retrieval layer.

## What the approved platforms actually are

Two of the approved bodies run **MCP servers**, and the brief lists one as part
of their technical availability — «مجاني للأفراد والجهات، واجهات برمجية عامة،
قاعدة مركزية موحّدة، **وخادم MCP**». Those servers are now the main retrieval
route. The REST APIs behind them are catalogues: addressed by id, browsed by
category, taking no query.

| Platform / endpoint                | Reach   | Addressed by                                        |
| ---------------------------------- | ------- | --------------------------------------------------- |
| `mcp.islamiccontent.org/mcp`       | ✅ live | query, then id — Qurʾān, hadith, الموسوعة بـ100 لغة |
| `mcp.tafsir.net/mcp`               | ✅ live | sūra + āya, and a Qurʾān concordance                |
| `terminologyenc.com`               | ✅ live | category → listing → id, per language               |
| `dorar.net`                        | ❌ 403  | its CDN blocks this server — reached by web search  |
| `qurancomplex.gov.sa`              | ❌      | no response                                         |

An earlier note in this file recorded `mcp.islamiccontent.org` as "not an MCP
endpoint, serves a landing page". That was wrong and is corrected here: the root
serves a landing page, the endpoint is at **`/mcp`**.

Both servers are public, read-only, free, and need no registration or key.
Neither requires anything of the reader — see "MCP is invisible", below.

### What each server is good for

The division of labour was **measured, not assumed**, and it does not follow the
corpus boundaries you would expect:

| Need                                | Server            | Why that one                                              |
| ----------------------------------- | ----------------- | --------------------------------------------------------- |
| Qurʾānic **text**                   | islamic-content   | ʿUthmānī with full diacritics, `ٱدۡعُ إِلَىٰ سَبِيلِ رَبِّكَ`     |
| Qurʾānic **search**                 | tafsir-center     | the other server's Qurʾān search returns 0 for every query |
| Hadith search, and the full report  | islamic-content   | `grade` and `attribution` as structured fields            |
| Reviewed daʿwa / belief material    | islamic-content   | موسوعة المحتوى الإسلامي, 100+ languages                   |
| Commentary, asbāb al-nuzūl, sūra data | tafsir-center   | 28 editions, 16 of them covering the whole Qurʾān         |

The two Qurʾān rows are the ones worth keeping straight. `search_quran_text` at
مركز تفسير matches **without diacritics**, so a reader who types «لا يكلف الله
نفسا» finds 2:286 — but its verse text comes back *unpointed*, `ادع إلى سبيل
ربك`, which must never be quoted as scripture. So `quran_search` composes the
two: find the reference at one server, fetch the canonical wording from the
other. The model sees one tool that returns properly pointed verses.

### Two protocol details that cost time

- **`fetch` is the citable path, not the prose tools.** `get_hadith` and
  `get_quran_verses` return the same material as prose wrapped in instructions
  aimed at a chat model — including a block telling the reading model to print
  the bare URL in its reply, which would collide with this system's own citation
  markers. `fetch` returns a structured document instead: `segments[]` tagged
  `exact` / `attribution` / `commentary`, plus `grade` and `attribution` as
  fields. That tagging *is* the brief's تمييز كلام المفسر عن النص, handed over as
  structure rather than left to a prompt.
- **One text part per result.** `search_quran_text` returns the whole result set
  in `structuredContent` and **one text part per hit**. Reading the first text
  part alone yields a single verse while looking like an empty result to a parser
  expecting the array — which is how the Qurʾān search silently returned nothing
  until the client was fixed to keep every part.

The `_display` fields that arrive on مركز تفسير payloads hold instructions
addressed to whichever model reads them. They are **never forwarded**: tool
output is data, and text that arrives from the network asking to be obeyed is
the one thing a retrieval layer must not pass to the model it feeds. The
reproduce-exactly discipline they ask for is already this system's own, stated
in its prompt where it belongs.

### MCP is invisible

A transport is not a source. Three consequences, all enforced:

- **No citation names it.** Every citation is attributed to the publisher whose
  text it is — «موسوعة القرآن», «موسوعة الحديث», «موسوعة المحتوى الإسلامي»,
  «مركز تفسير» — keyed on the body that *published* the text, not the host that
  serves the page and not the protocol that fetched it. A verse's page lives on
  `islamenc.com` and its text is موسوعة القرآن الكريم's; the label says the
  latter, because that is what a reader weighs a citation by.
- **The reader wires nothing.** The connections are server-side, to fixed public
  endpoints. The reader asks a question; they do not connect, approve, or
  configure anything, and the word MCP appears nowhere in the UI, the prompt, or
  a citation label. The waiting line names the source being read — «يبحث في
  موسوعة الحديث» — never the mechanism.
- **The gateway is not the source of record.** A request goes to
  `mcp.islamiccontent.org`; the document it returns was published at
  `hadeethenc.com`. `assertAllowed` cannot see that second hop. So the gateways
  are admitted by their own closed list — `SERVERS` in `mcp/client.ts` — and
  every document they return has its **publisher host** checked against the
  allow-list before it can become a citation. Two gates, each guarding what it
  can actually see.

**Closed, 6 Oct 2026.** `dorar.net` is now read for every hadith the system
reads, through this same web search — see `sources/dorar.ts`. It was never a
reachability problem in the end: `WEB_DOMAINS.hadith` already allowed
`dorar.net`, and the approved web search already returned it. What was missing
is that consulting it was the model's choice, and موسوعة الحديث answers first
and well, so the model stopped there every time. It now runs with
`read_sources` rather than beside it.

Two things the integration had to get right. Dorar's own CDN refuses this
server outright — Cloudflare 403 on `dorar_api.json` and on every HTML path,
with or without a browser user-agent — so its **published JSON hadith API** at
`dorar.net/article/389` is closed to us as well; the web search is not a
second-best path, it is the only one. And the search returns two kinds of text
for one page: Dorar's ruling block quoted verbatim, and the search model's own
summary of it, carrying the same labels and the same colons. Only the first may
parse — the discriminator is that Dorar writes `label` space `:` space `value`
and prose writes `label:` — because the alternative is a model's paraphrase
shown on screen under a muḥaddith's name.

What it yields, measured: «إنما الأعمال بالنيات» → الألباني and النووي;
«من حسن إسلام المرء تركه ما لا يعنيه» → eleven rulings that disagree, النووي
حسن against البيهقي مرسل against ابن عدي ضعيف. About 5 s per hadith, at most
three per read, in parallel, and soft throughout: a failed or empty search
leaves the encyclopedia's own grading untouched.

~~`dorar.net` remains the significant gap: the one approved platform with graders'
rulings as structured data, unreachable from this host at its CDN. It is read
through the domain-locked web search instead, which works but returns pages
rather than records.~~

Two search lists were added after auditing the brief source by source:

- **`terminology`** had no list at all, so موسوعة الجمهرة
  (`islamic-content.com/dictionary`) — which the brief ranks *above* automatic
  translation for sensitive terms — was reachable from the دعوة and شبهات
  intents and not from the one intent it governs. The terminology
  encyclopedia's own API is addressed by id and cannot be searched by phrase, so
  a reader who named a term rather than browsing to it could reach neither
  dictionary.
- **`risala.prh.gov.sa`** (رسالة الحرمين) joined the `fiqh` list rather than
  getting an intent of its own, because the brief files the rites under الفقه
  العام. Measured: a ṭawāf al-wadāʿ question returns 12 passages from it,
  including its own hajj-and-ʿumra fatwa collection. It does not always outrank
  `binbaz` and `islamqa` in the combined search, which is acceptable — all three
  are approved for the domain.

## The tools, and how they are gated

`lib/rfeeq/sources/tools.ts` exposes twelve tools, and `sourceToolsFor(intent)`
decides which a given question may use. Gating by offering is stronger than
gating by instruction: a model cannot misuse a tool it was not given.

| Intent           | Tools                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------ |
| `quran`          | `quran_verse`, `quran_search`, `surah_info`                                                |
| `tafsir`         | + `tafsir_get`, `tafsir_sources`, `nuzool_reason`, `approved_web_search`                   |
| `hadith`         | `hadith_search`, `read_sources`, `quran_verse`, `quran_search`, `approved_web_search`      |
| `terminology`    | `term_categories`, `term_list`, `term_get`, `approved_web_search`                          |
| `fiqh`           | `approved_web_search`, `quran_verse`, `quran_search`, `hadith_search`, `read_sources`      |
| `aqida`, `dawa`, `sira-history`, `shubuhat` | `approved_web_search`, `library_search`, `read_sources`, and the checking tools |
| `fatwa-referral` | the fiqh set — the sources do not change, the answer contract does                         |

The category-browsing tools are **gone**, with the guessing they existed to
support: `hadith_categories` and `hadith_list` were there only because the REST
API took no query, so an agent had to pick one of 493 chapters before it could
read anything. When a search finds nothing now, the fallback is
`approved_web_search`, which reaches the platforms carrying the weak and the
fabricated reports *with* their gradings — a better fallback than a chapter
listing ever was.

Only the **last user turn** is classified. A follow-up inherits nothing: «وما
الدليل؟» after a hadith question is its own question, and letting an earlier turn
widen the available sources is how an allow-list leaks.

Rules enforced in the adapters rather than in the prompt, in
`mcp/documents.ts`:

- **No citation from a report missing its grading or attribution.** The brief's
  hadith rule in code, so no prompt drift can surface an ungraded report as
  evidence. The answer is then left with nothing to quote — which criterion 4
  says is the correct outcome.
- **No citation from an unapproved publisher host**, the second-hop check above.
- **The original is separated from its rendering.** When a document carries more
  than one `exact` segment — a verse and its approved translation — the first
  becomes the chunk's text and the rest travel as `translation`. Acutely
  necessary for Arabic, where the "translation" is التفسير الميسر, a paraphrase
  that reads like scripture.
- **Commentary travels in metadata, not in the quotable text**, so a modern
  gloss cannot be quoted as the Prophet's words while remaining available to
  summarise with attribution.

Navigation output is deliberately shaped so it cannot be cited: the search tools
return `{ results }` rather than a bare array, because the citation layer treats
any array a tool returns as retrieved passages, and a search hit carries no
grading.

## What this changed elsewhere

The citation plumbing matched `tool-search` and `tool-expand` by name, which
made any new retrieval tool invisible to it — chunks never reached the sources
panel, citations against them resolved to nothing, and a verse fetched from an
approved source would have been flagged unverified because it was absent from
the quote-verification haystack. `retrievalChunks()` in `lib/tool-output.ts` now
decides by what a part _returns_, so adding a source no longer means editing the
renderer. The sources panel, `citation-resolve.ts` and `verify-quotes.ts` all
read through it.

Moving to these servers also surfaced a routing bug that had nothing to do with
them. Intent patterns are tested against *normalised* text, and `normalise`
folds «ى» to «ي» and «ة» to «ه» — so six terms written «معنى» could never match
anything, because by the time the pattern ran the question said «معني». Every
«ما معنى …» question was falling through the tafsīr and terminology rules into
whatever matched next. The pattern compiler now folds each term the same way the
input is folded, which closes the class rather than the instances. A second
pattern required a definite article on the explained thing, so «تفسير الآية»
routed to commentary while «تفسير آية الكرسي» — the same question — routed to
the bare-Qurʾān rule, which offers no commentary tool at all. Both are fixed and
both have regression tests.

## What this does and does not solve

Every intent now has at least one live approved source:

- **`quran`** — canonical pointed text, a diacritic-insensitive concordance, and
  sūra data by lookup. This is what eval **case 11** needed and the system
  previously had no way to supply.
- **`tafsir`** — 28 commentary editions under each commentator's own name and
  death year, plus asbāb al-nuzūl that reports «لم يثبت» as a finding rather
  than a failure.
- **`hadith`** — query-driven search, then a read that refuses to cite anything
  without its grading.
- **`terminology`** — the approved equivalent per language, by lookup.
- **`aqida`, `sira-history`, `shubuhat`, `dawa`** — the reviewed material in
  موسوعة المحتوى الإسلامي alongside the domain-locked web search. These four
  previously had **no adapter at all** and fell back to the ingested corpus.
- **`fiqh`** — domain-locked web search over the fatwa bodies and fiqh
  encyclopedias, with the Qurʾān and hadith tools for checking what they cite.

All of it live: no ingestion, and a claim traceable to the source at the moment
it is made rather than to a snapshot of unknown age.

**Nothing is ingested, by decision.** The semantic work that an index would do
happens in the query-understanding stage instead.

What that does not buy is depth. Web search reads the pages a query surfaces,
not the whole of a book, so an answer is as good as the phrasings tried — which
is why there are five of them and why each result records the one that found it.
A question whose answer sits in a chapter none of the five phrasings names will
come back thin, and the tool says so rather than filling the gap.

One residual risk is worth naming. `quran_search` tells the model that a phrase
finding nothing is not a verse — which is the right answer, and the measured
behaviour. It is only sound while an empty result means "not present": if the
concordance ever returned empty *because it was broken* rather than because the
phrase is absent, the system would deny a real verse. A transport failure raises
and is reported as unavailable, so this is narrow — a silently empty index, not
a down one — but it is the one place where a false negative would be confidently
worded.

The materials for an ingested path exist if that trade is ever revisited:
`shamela.ws` publishes a full database download, and `icadb.com` carries موسوعة
الأسئلة والأجوبة (for Muslims and for non-Muslims), موسوعة الفرق والأديان,
موسوعة الأعلام, the دعوة dictionaries, 344 books and موسوعة شرح صحيح مسلم من
الدرر السنية, with sentence-level alignment and stable ids. Recorded here so the
option is a choice rather than a rediscovery.
