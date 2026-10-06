# The answer templates

How an answer is shaped, and why the shape is code rather than a prompt
instruction.

Authority: **MVP Templates**, 30 September 2026, for the section contract, and
the approved prototype's design-system syncs of **5 and 6 October 2026** (v1.10)
for the type scale, the rhythm and the section revision below. Together they
define each subject's answer as an ordered list of named sections with a
declared collapse state. Its
governing rule is stated twice:

> مهمة البطاقة أن تَعُدّ وتُلخّص ثم تفتح عند الطلب؛ فالبطاقة التي تعرض كل ما
> لديها لا تُقرأ.

and, for the folds:

> تُفتح بالنقر إن لم يكن السؤال عنها، وتظهر مباشرة إن سُئل عنها.

## Why this is not a prompt

A prompt asking for "the shortest answer first, details folded" produces that
shape *sometimes*. The specification needs it **every time, in a fixed order,
with the fold state decided by the template rather than by the run** — and none
of those three properties survive being left to generation. So:

| What | Decided by |
| --- | --- |
| Which sections exist, and in what order | `lib/rfeeq/templates.ts` |
| Whether a section is folded | `lib/rfeeq/templates.ts` |
| Whether a fold opens for this question | `openSections()`, from the question |
| The verse, the reference row, the grading | the retrieved chunk |
| The prose inside each section | the model |

The model's job is narrowed to filling named slots. It never decides the order,
never writes a heading, and never retypes a verse.

## The contract

The prompt gains an `<answer_format>` block — `answerFormat(template)` — listing
the routed template's sections as numbered slots. The model emits:

```
<part k="ayah" ref="quranenc-16-125#0"></part>
<part k="reference" ref="quranenc-16-125#0"></part>
<part k="gharib">«الحكمة»: العلم النافع…</part>
<part k="tafsir">معنى الآية…</part>
```

Two kinds of section, and the difference is the point:

- **prose** — the model writes it.
- **structural** — the model supplies only a chunk id in `ref`, and the renderer
  builds the content from that chunk's data. A verse that arrives through
  `metadata` is verbatim by construction, and a grading copied out of a field
  cannot be reworded. That turns the brief's hadith rule and its
  «تمييز كلام المفسر عن النص» from conventions into facts about the renderer.

A verse card is the limit case: two markers, no prose, the entire answer
rendered from retrieval data.

## The sections, per template

Folded sections are marked **⌄**; everything else renders expanded.

Folded sections are marked **⌄**; ⛊ marks a section that carries a source's own
words and shows the «مصدر موثّق» tag beside its heading.

| Template | Sections, in order |
| --- | --- |
| `aya` | الآية · السطر المرجعي · سياق السورة |
| `tafsir` | الآية · السطر المرجعي · ⛊ التفسير المختصر · **⌄** غريب القرآن · **⌄** من فوائد الآيات |
| `hadith-card` | الحكم · المتن · السطر المرجعي · ⛊ حكم الحديث · **⌄** أحكام المحدّثين |
| `hadith-explain` | المتن · السطر المرجعي · ⛊ حكم الحديث · **⌄** أحكام المحدّثين · المعنى المبسّط · **⌄** غريب الحديث · **⌄** الفوائد العملية · **⌄** ترجمة الحديث |
| `fatwa` | السؤال كما فهمناه · ⛊ الحكم الراجح · الحكم التفصيلي · **⌄** الأدلة · **⌄** اختلاف العلماء · ⛊ الجهة المفتية · ⛊ المصدر |
| `arabic` | المعنى اللغوي · المعنى الاصطلاحي · الألفاظ ذات الصلة · الاستعمال القرآني · الاستعمال الحديثي |
| `general` | the answer · **⌄** الأدلة |

v1.10 revised four of these. A commentary now **leads with the commentary**,
with غريب القرآن folded beneath it — the earlier order opened on the glossary,
which put the least-asked-for part of a commentary answer at the top of it. A
fiqh ruling splits into الحكم الراجح and الحكم التفصيلي, making «يبدأ الجواب
الفقهي دائمًا بالحكم واضحًا، ثم يأتي التفصيل» literally two slots. Both hadith
templates lead with حكم الحديث: a reader asking what a report *means* still
needs to know first whether it is established.

`hadith-card`'s opening prose slot is **ours, not v1.10's**, and is kept on
purpose: the prototype models a hadith that is in the encyclopedia, while the
brief's case 6 requires the system to say plainly that no matching evidence was
found. Without a prose slot the template could not answer that at all.

### Type and rhythm

v1.10 sets the answer's own scale and spacing, and both are in `rfeeq.css` and
`ANSWER_PROSE` rather than chosen per component: body 16/2, headings 16/1.5,
sub-block headings 15, the ruling line 600 17/1.9. The rhythm is spelled out —
heading → text 4px, paragraph → paragraph 12px, list item → item 4px, section →
section 24px, collapsed → collapsed 8px. The numbers are small and uneven, and
rounding them to a scale is the obvious tidy-up that would undo what they are
for.

Revealed text is **16px at weight 400 on a fixed 50px leading**. That leading is
enormous by prose standards and deliberate: it is muṣḥaf setting, where the
space between lines is what makes pointed Arabic legible.

And the muṣḥaf face is the **Qurʾān's**, not scripture's in general — «Asked-about
hadith: answer-body font, not the Quran font». A report, even the one a question
is about, is set in the answer's own face. The earlier treatment gave both the
Qurʾānic face on the reasoning that revealed text should read as one vocabulary;
the design draws the line one step further in, between the recited word and a
narrated one.

`fatwa` leads with the ruling because the specification says so — «يبدأ الجواب
الفقهي دائمًا بالحكم واضحًا، ثم يأتي التفصيل» — and an answer that explains for
two paragraphs before stating the ruling has failed the template even if every
sentence in it is true and sourced. `hadith-explain` folds nothing: the reader
asked for the explanation, so the explanation is not detail to be opened.

### Which folds open

`openSections(template, question, routing)`. «ما معنى كلمة …؟» opens غريب
القرآن; «ما فوائد الآية؟» opens الفوائد العملية; «ما الدليل؟» opens الأدلة.
اختلاف العلماء reuses the router's `asksDisagreement` rather than re-detecting
it — the specification's rule for that case is the same one: «وإن سُئل عن الخلاف
مباشرة، يُعرض الجدول في الشاشة الرئيسية».

### معنى لفظ, and where it sits among the others

The specification's §6 — «قالب لبيان معنى أي لفظ», whose own example is «ما معنى
التقوى؟». A base that applies to every word, then two additions that appear only
when the word is actually used in the Qurʾān or the Sunna:

- **المعنى اللغوي · المعنى الاصطلاحي · الألفاظ ذات الصلة** — the base, never
  folded, because it *is* the answer.
- **الاستعمال القرآني** — built from data, below.
- **الاستعمال الحديثي** — a hadith or two in which the word is used, with its
  grading.

A new `language` intent routes to it, and **its position in the rule list is the
design**. A meaning question about a word that already belongs to a domain
belongs to that domain: the brief's case 7 («ما معنى التوحيد لشخص لم يسمع
بالمصطلح من قبل؟») is ʿaqīda, «ما معنى كلمة «أبّا» في القرآن؟» is غريب القرآن,
«ما معنى مصطلح الإحصان؟» is المصطلحات. Each of those rules sits above the
lexical one and takes its question first, so what reaches `language` is a word
with no subject of its own — which is exactly what the template is for.

The first attempt put the rule high and carved exceptions with a negative
lookahead. It broke both the brief's case 7 and the غريب القرآن case, and the
tests caught both. The exclusions are the other rules.

#### The root, which nothing hands you

«ورد الجذر (…) في القرآن (…) مرة» is keyed on the **root**, and no tool maps a
word to its root: `analyze_word` does, but only for a word at a known position
in a known āya. So `lexicon.ts` walks a chain —

1. find the word anywhere in the Qurʾān (`search_quran_text`),
2. work out which word of that āya matched, from the `<m>…</m>` the snippet
   marks it with — the index's own tokenisation, which is what `analyze_word`
   numbers against,
3. analyse that word and read its stated مادة,
4. ask the concordance (`get_root_stats`, `find_root_occurrences`).

Four calls to answer «ما معنى التقوى؟» properly. The alternative was to let the
model supply the root from its own knowledge, which is the one thing this system
does not do with anything a source can be asked for.

Two details earn their place. The index is **token-exact**, so «الصبر» finds
nothing while «صبر» finds two — the muṣḥaf spells it «بِٱلصَّبۡرِ» and the
clitics stay attached — so the lookup retries without the article. And the
counts in the table are read from `total_occurrences_in_quran` per form rather
than tallied over the sample, since a tally would undercount whatever the sample
cut off.

Measured: «التقوى» → root وقي → «ورد الجذر (وقي) في القرآن 258 مرة، في 63 سورة
و237 آية، على 57 صيغة», with واتقوا (38), المتقين (23), تتقون (19)… each with an
example reference.

### الأدلة, as data

The specification gives evidence a template of its own, and is explicit that it
is **not the fiqh template's property**: «عند وجود دليلين فأكثر تُعرض الأدلة في
جدول بدل الأقسام، في أي مجال وليس في الفقه وحده». So `evidence` is a section on
both `fatwa` and `general` — and `general` is what every intent without a card
of its own renders as, which is where an ʿaqīda answer or a reply to a shubha
lands.

The model emits one marker per proof, with its parts named:

```
<part k="evidence" issue="وجوب الزكاة">
<ev t="القرآن" by="علماء التفسير والفقه" why="أمر صريح بإيتاء الزكاة، والأمر يقتضي الوجوب"
    src="سورة البقرة: 43" ids="quranenc-2-43#0">﴿وَأَقِيمُواْ ٱلصَّلَوٰةَ…﴾</ev>
<ev t="السنة" by="جمهور العلماء" why="بيان أن إيتاء الزكاة ركن" src="متفق عليه"
    ids="hadeethenc-65000#0">عَنْ عَبْدِ اللهِ بنِ عُمَر…</ev>
</part>
```

Attributes rather than nested markers, and the reason is specific: Arabic does
not use ASCII double quotes — scripture is delimited with ﴿﴾ and «» — so the
values are safe unescaped, which is what makes a single flat marker workable.

Three things are decided in `lib/rfeeq/evidence.ts` and not by the model:

- **The order** — قرآن ← سنة ← إجماع ← قياس, stable within a type. This is
  scholarship, not presentation: a table that led with qiyās would misrepresent
  how the ruling was reached. The model is told not to sort.
- **The threshold** — a table at two proofs, an ordered item at one. «دليلان على
  الأقل، وإلا تُعرض الأدلة بالترتيب». A single-row table claims a comparison
  that is not there.
- **The colour** — one per type, from `--rf-t-q` / `-s` / `-i` / `-k`, which were
  ported with the palette and unused until now. On the row's leading edge, so
  one glance says whether a ruling rests on a verse or on an analogy.

A proof whose type cannot be read is **dropped** rather than placed: the colour
and the sort position both encode which of the four it is, so a row placed by
guesswork would assert a position in the hierarchy that nothing said.

The closed fold carries the count — «الأدلة ٣» — which is what tells a reader
whether opening it is worth a tap, and the whole point of a card that counts
before it opens.

Measured on real output: a زكاة question produced five proofs — two Qurʾānic,
two prophetic, one ijmāʿ — ordered correctly, every one of the five chunk ids
resolving to an actually retrieved passage.

### The grading, in two colours

«نظام ثنائي واضح ومباشر يعتمد أقسام الدرر السنية الأربعة، لتقليل الحاجز
الذهني» — green for the sound, red for the weak, in `lib/rfeeq/grade.ts`. Two
values is a *presentation* decision: the grading's own words are always shown
beside the colour, because the brief forbids rewording them, and an unrecognised
grading renders uncoloured and complete rather than being forced onto one side.

The negation is matched as a negation. «غير صحيح» contains «صحيح», so no order of
substring tests gets it right — and getting it wrong paints a weak hadith green.

## The reader's level

The specification's third axis, and the one with the sharpest consequence:

> التفسير حسب مستوى المستخدم — **تختلف المصادر بحسب مستوى السائل**.

Different *sources*. It is not the depth preference under another name — depth
is a length control and is written as one — so this is a retrieval decision
before it is a presentation one, and the editions live in
`lib/rfeeq/expertise.ts` rather than in a component.

| | غير المتخصص | المتخصص |
| --- | --- | --- |
| Editions read | التفسير الميسر · المختصر في تفسير القرآن الكريم | السعدي · البغوي · ابن كثير · الطبري |
| Register | الفصحى البيضاء — short sentences, a term explained where it is used | the technical idiom, **مع ذكر الطبعة** |
| Khilāf | the approved position; no survey the reader cannot act on | the positions, their causes, and who preferred which |

The two edition sets are **disjoint**, which is the point: a different library,
not a longer version of the same one. Verified end to end — the same question
asked at each level retrieved `moyassar, mukhtasar_ar` and `baghawy, katheer,
saadi, tabary` respectively, and the answers quote «التفسير الميسر» and «أبو
جعفر الطبري (ت. 310هـ) في كتابه جامع البيان» accordingly. The side panel reads
the same axis, so a reader is never shown one library in the body and another in
the pane.

### A wrong default, not a missing feature

`DEFAULT_SOURCES` in `mcp/tafsir.ts` was الطبري، ابن كثير، السعدي — the set the
specification reserves for specialists — and it was being served to everyone.
That is worse than having no axis: it hands a reader who asked a plain question
four classical commentaries and neither of the two written to be read plainly.

`fetchTafsir` now takes `sources` as a **required** parameter. A default there
could only be the wrong one for somebody, and making the caller say which is
what keeps the axis honest; `tafsir_get` correspondingly exposes no `editions`
argument, because which library a reader is served is not the model's to
re-decide mid-answer.

Absent a preference the general reader wins. A specialist served plain
commentary is under-served; a general reader served الطبري is not served at all.

### What the axis does not change yet

- **The specialist hadith pane** (اسم الكتاب والباب · الإسناد · تعدّد الأحكام ·
  الشروح · الشواهد). No data source — see the side panels below. The hadith half
  of the axis is therefore carried by the register alone, which is also where the
  specification's «المعنى المبسّط بالفصحى البيضاء» lands.
- **The grade colours.** The specification assigns yellow and black to the
  specialist explicitly «مستقبلًا», so bipolar for both levels is current, not
  pending.

## The side panels

«ما يُنقر: الكلمة · الآية · السورة · الحديث · الراوي · العالم · المحدّث · اختلاف
العلماء» — the specification puts علوم القرآن behind a tap rather than in the
answer, and sets the default state in one sentence that decides the whole
layout:

> ما لم يكن السؤال مباشرًا عن أيٍّ مما سبق، تُعرض هذه العلوم في اللوحة الجانبية
> **مطويّة**.

Three of the taps are built, and all three were already reachable over MCP —
this was tools that had not been wired, not data that did not exist.

| Tap | Pane | Blocks |
| --- | --- | --- |
| the sūra name | مقدمات السورة | أسماء السورة · المكي والمدني · فضائل السورة · الإحصاءات (9 figures) |
| the āya number | علوم الآية | أسباب النزول · التفاسير (6 editions) · إعراب الآية · غريب القرآن · التجويد · القراءات |
| any word of a verse | علوم الكلمة | المعنى · مشكل الإعراب · التصريف · الرسم · إحصاءات الجذر |

Every block is a closed `<details>` whose label is visible — eight sciences
shown at once is a wall, eight folds is a table of contents — and each names its
own source, per «ويُكتب المصدر أو المصادر بعد كل فقرة». For the commentary that
is the edition's own attribution line, which is the citation a tafsīr actually
needs: which commentator, and when he died.

Fetched when the pane opens, not with the answer (`/api/rfeeq-sciences`). That
is the specification's own logic rather than an optimisation: eight reads per
verse for material most readers never open would slow the one thing they are
waiting for.

### Two things worth knowing

**A word's index is trusted, and the word is shown.** The verse on screen is the
ʿUthmānī text from موسوعة القرآن; the index is resolved against مركز تفسير's own
tokens. The two follow the same muṣḥaf word division — checked on 2:153, 112:2,
16:125 and 2:286, the last of them 49 words, and on 16:125 the 22 rendered words
match the centre's own `word_count` — but the pane still *names the word it
analysed* as its heading. That way a divergence would be visible to the reader
rather than quietly handing them another word's grammar.

**Words are tappable on a verse and not on a matn.** The centre indexes the
Qurʾān word by word and indexes nothing of the kind for a hadith, so the same
affordance there would be a tap that leads nowhere. Likewise a verse chunk
without `sura`/`aya` offers no taps at all: a control that opens nothing is
worse than plain text, because it promises something.

### The panel, after v1.10

- **Resizable** — drag the inner edge, arrow keys (Shift for a bigger step),
  Home or a double-click to reset. 400px default and floor, 40% of the screen as
  the ceiling. The surface is RTL, so the width is the distance from the frame's
  left edge to the pointer; a mirrored build needs that one subtraction flipped.
- **Each science is a bordered collapsible card**, not a ruled disclosure, which
  is what makes a pane of eight folded sciences read as a list of things rather
  than one long column.
- **A tab strip** switches between الآية and الكلمة. It earns its place by what
  it fixes: a reader who taps a word has left the āya behind, and without it the
  only way back was to close the pane and tap the verse again.
- **The word's sciences are a table** — meaning, parse, derivation, rasm — since
  they are already key and value. The āya's own tajwīd and iʿrāb stay prose:
  the centre returns them as running prose about the whole verse, and cutting
  them into rows would draw a structure the source never did.
- **Figures put the number above its label**, so the eye runs down the column
  instead of zig-zagging.
- **Sources open in place.** The list-then-detail navigation is gone; comparing
  two sources was a round trip through a back button, which is exactly what a
  reader checking a ruling against its sources spends their time doing.
- **الترجمة** is a block in the āya pane, fed by موسوعة القرآن's own published
  edition, and a «ترجمة الآية» link on a commentary answer opens it. The
  translation of revealed text is the last thing this system should compose for
  itself when an approved one exists.

### What the data does not support

The specialist **hadith** pane — اسم الكتاب والباب · الإسناد مع الجرح والتعديل ·
تعدّد الأحكام · الشروح · اختلاف الألفاظ بين الروايات · الشواهد — is **not
built**, and not because of effort. موسوعة الحديث returns the matn, the grading
and the attribution and nothing of the isnād or the shawāhid; neither MCP server
carries rijāl criticism. الدرر السنية has it, and is reachable only through the
domain-locked web search, which returns pages rather than records. Building the
pane against that would mean a model summarising an isnād — which is the one
thing this system must not do with a chain of narration.

The **recitation** levels (الكلمة · الآية · الصفحة) are likewise unbuilt, though
here the data *is* there: `get_quran_audio` is on the encyclopedia server. What
is missing is a player, not a source.

## Degrading

The parser repairs rather than trusts, on the same reasoning as the citation
tags: the prompt already specifies the format, and a rule the model must hold
onto several thousand tokens into an answer is a preference, not a guarantee. It
tolerates an unquoted value, an attribute under another name, a never-closed
tag, an undeclared key, and sections emitted out of order.

**No text is ever lost.** Prose written before the first marker, or inside a key
no template declares, still reaches the reader as unlabelled body above the
stack. A formatting slip must cost some structure, never an answer.

When a template yields no sections at all, the answer renders as plain prose
under a note that says so — «لم تتوفّر بيانات كافية لعرض الإجابة بقالب «…»،
فعُرضت بالقالب العام مع مصادرها». That is criterion 4 expressed in the interface
instead of the prompt: an answer that quietly drops its structure looks exactly
like one that never needed it.

## What this broke on the way in, and how

Three defects, all found by running it rather than by reading it. Recorded
because each is the kind that looks like someone else's bug.

- **Every hadith answer was discarded and regenerated.** The language gate
  judges the first 180 characters, and `hadith-explain` opens with three
  *structural* sections whose markers are pure Latin — so the gate saw no Arabic
  at all, concluded the answer was English, and rejected it. `prose()` in
  `agentic-search/language.ts` now strips markup before the count. The symptom
  was an empty answer and a 400 from Gemini, which looked nothing like a
  formatting problem.
- **The retry then failed its own API call.** `Requests ending with a model turn
  are not supported` — the rewrite path replays the previous attempt's assistant
  output, so the request ended on a model turn. The rewrite instruction is now a
  closing **user** turn, which fixes the shape and also puts it adjacent to
  generation. Latent before this work; any language mismatch would have hit it.
- **A verse card was bannered as citing nothing.** `citesNothing` counted only
  `<citation>` tags, and a structural answer has none — its attribution is the
  `ref`. The most completely sourced answer the system produces was being
  flagged as the least. Fixed twice over: `uncited.ts` now recognises
  attribution by **shape** rather than by tag name — any marker bearing a
  non-empty `ids` or `ref` attributes its passage — because enumerating tag
  names meant each new marker silently started reading as unsourced, and the
  evidence rows would have been next.

## Not done

- **The specialist hadith pane and the recitation**, for the reasons above: the
  first has no data source this system may responsibly summarise, the second
  needs a player.
- **Splitting a «متفق عليه» hadith into two sources.** v1.10 gives Bukhari and
  Muslim a slot each, and the prototype can because its fixture carries both
  numbers. موسوعة الحديث returns `grade` and `attribution` and no per-collection
  reference, so the split would produce «صحيح البخاري» and «صحيح مسلم» with
  nothing to cite — worse than one correctly labelled «متفق عليه» entry. Blocked
  on the printed references, not on effort.
- **The badge row** — template · domain · engine.
