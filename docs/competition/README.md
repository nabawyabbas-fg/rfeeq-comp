# تحدي الذكاء الاصطناعي في خدمة المحتوى الإسلامي

Reference pack for the competition instance of Rfeeq, served at
**comp.rfeeq.ai**. Everything here derives from the challenge's binding brief,
*المرجعية والحزمة العلمية والبيانات*, version **20/3/1448** — kept in `spec/`.

## Contents

| File | What it holds | Why it matters |
| --- | --- | --- |
| `scope-and-levels.md` | نطاق المحتوى, the four response levels أ–د, and the eight binding criteria | Defines what the system may *assert*. Includes an audit of which criteria the current prompts already enforce and which have no counterpart. |
| `approved-sources.md` | The retrieval allow-list by domain, every platform with its API/MCP endpoint | A claim not traceable here cannot be used. This is the basis for the intent split. |
| `eval-questions.md` · `.json` | The twelve published test cases with level and intent, plus per-case assertions | Regression floor. Three cases fail against current behaviour; they are named. |
| `terminology.md` | The ten sample terms with approved English equivalents and ضوابط | Sensitive terms need a dictionary lookup, not a translation. |
| `intent-map.draft.md` | **Draft** intent taxonomy, and the open questions | The design the classifier was built to. Implemented in `apps/web/src/lib/rfeeq/intent.ts`; open questions 1, 2 and 4 are still open. |
| `retrieval.md` | How the system reaches the allow-list, and why not through web search | The enforcement point, what each approved platform actually offers, and which domains are still uncovered. |
| `templates.md` | The answer templates: sections, fold state, and the `<part>` contract | The MVP spec's ordered sections rendered as code rather than asked for in a prompt. Includes what it broke on the way in. |
| `ui.md` | What the approved prototype turned into, and what is still a stub | Where each screen lives, why the two axes are split the way they are, and what cannot work until a corpus is ingested. |
| `spec/` | The original PDF and the extracted text | Archived raw, so improving the extraction never means re-fetching. |

Related: `../prompt-archive/` holds the predecessor qaf/turath system prompts,
kept for reference; the live prompt composition is
`apps/web/src/lib/agentic-search/corpus-prompts.ts`.

## The three constraints that shape everything else

1. **إصدار الفتوى الشخصية المستقلة is out of scope.** Not a topic ban — a limit
   on the speech act. The system may report a ruling a source states; it may not
   issue one for the asker's situation. Level (د) exists for exactly this.

2. **Every claim must be traceable, and the generated explanation must be
   visibly distinct from the revealed text.** Rfeeq already enforces citation
   discipline and checks quoted scripture at render time; what is new is the
   explicit separation of مفسر commentary from the āya, and hadith never
   appearing without **both** source and grading.

3. **When the evidence is absent, abstaining is the correct answer.** مقاومة
   الهلوسة ranks abstention and referral above a confident unsourced answer.
   Test case 6 scores this directly.

## Status

A clone of the stg app taken on 2026-10-05, including the uncommitted
scoped-search and quote-panel work, plus the competition work since.

Built: the consumer surface at `/` from the approved prototype (`ui.md`); the
two-axis classifier in `lib/rfeeq/intent.ts` (intent × level أ–د) with the level
contracts in `lib/rfeeq/prompt.ts`; and live retrieval from the approved
platforms (`retrieval.md`) — two publishers' MCP servers for Qurʾān, hadith,
tafsīr and the reviewed daʿwa material, the terminology encyclopedia direct, and
a domain-locked web search for the platforms with no API.

**Nothing is ingested, by decision.** There is no corpus and no namespace; the
semantic work an index would do happens in query understanding instead. Every
claim is traced to the source at the moment it is made.

Still open: criterion-by-criterion verification against all twelve eval cases,
and open questions 1, 2 and 4 in `intent-map.draft.md`. See
`../../COMPETITION.md` for how to run it.
