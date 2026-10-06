# Scope and response levels

Transcribed from the challenge's binding brief, *المرجعية والحزمة العلمية والبيانات*,
version 20/3/1448 (`spec/`). The Arabic is quoted verbatim because it is the
binding text — anything a prompt enforces has to be traceable to these words,
not to a paraphrase of them.

## نطاق المحتوى المعتمد

**In scope** — المحتوى الإسلامي وما يرتبط بخدمته وإدارته والوصول إليه والتحقق
منه والبحث فيه وتقديمه وترجمته وإعادة توظيفه، إضافة إلى التعريف بالإسلام
والتواصل الحضاري، والإجابة العلمية عن الأسئلة العامة والشبهات، وتمكين الباحثين
والمترجمين والمحررين والمعرّفين وصناع المحتوى والجهات ذات العلاقة، والمسارات
المعرفية المناسبة لمختلف المستفيدين.

**Out of scope** — ولا يدخل في النطاق إصدار الفتوى الشخصية المستقلة، أو الحكم على
الأشخاص والجماعات، أو معالجة النزاعات الخاصة، أو بناء أحكام شرعية على وقائع
فردية غير متحققة.

The exclusion is the load-bearing half. It is not a content filter — it is a
constraint on what kind of speech act the system may perform. The system may
report a ruling that a source states; it may not issue one.

## مستويات المحتوى وضبط الاستجابة

| المستوى | النطاق | التعامل المعتمد |
| --- | --- | --- |
| **(أ) معلومات أصلية مستقرة** | القرآن، الأحاديث الصحيحة المعتمدة، أركان الإسلام والإيمان، السيرة الأساسية، الأخلاق والقيم، المعلومات التعريفية المستقرة. | الإجابة المباشرة الموثقة بالمصدر. |
| **(ب) شرح وتعريف واستدلال** | شرح المفاهيم، المقارنات، مقاصد التشريع، الإجابة عن الأسئلة الفكرية والشبهات العامة. | الإجابة من المادة المعتمدة مع إظهار المرجع، وتجنب القطع فيما يحتمل الخلاف. |
| **(ج) مسائل خلافية أو عالية الحساسية** | الخلاف الفقهي، المسائل العقدية التفصيلية، القضايا التاريخية الجدلية، الأسئلة التي تتطلب تحريرًا علميًا خاصًا. | إجابة مقيدة بما هو معتمد، أو بيان وجود الخلاف، أو الإحالة للمختص. |
| **(د) فتوى أو حالة شخصية** | الحكم على واقعة فردية، صحة عقد أو عبادة لشخص بعينه، نزاع أسري، مسائل قانونية أو طبية ذات أثر شرعي. | لا يقدم النظام حكماً مستقلاً: يوضح المعلومات العامة ويحيل إلى جهة مؤهلة. |

The levels are a property of **the question**, not of the corpus searched. The
same book can answer a level-(أ) question and a level-(د) one; what changes is
what the system is permitted to say back. This is the main structural difference
from the existing Rfeeq prompt system, which keys the prompt off the namespace.
Both axes are needed here: intent selects *where to search*, level selects *what
may be asserted*.

## المعيار العلمي الملزم لمخرجات الحلول

يُشترط في الحلول والمخرجات المقدمة ضمن جميع المسارات، بحسب طبيعتها:

1. **الموثوقية والإسناد** — كل معلومة شرعية أو اقتباس أو حكم يعرضه الحل يجب أن
   يكون قابلاً للتتبع إلى مصدره، وألا ينسب نص أو قول إلى مرجع لا يوجد فيه، وأن
   يفرق بين النص الشرعي والشرح المولد، وأن يصرح بعدم كفاية المعلومات عند الحاجة.
2. **التمييز بين القطعي والاجتهادي** — لا تعرض المسائل الخلافية والاجتهادية بصيغة
   القطع، ويشار إلى الخلاف بقدر ما يحتاجه السياق دون إغراق المستخدم في تفصيل لا
   يخدم مقصده.
3. **عدم الاستقلال بالفتوى** — لا يستقل النظام بالفتوى الشخصية أو بالحكم في
   المسائل التي تتطلب معرفة الوقائع أو تقديرًا شرعيًا متخصصًا، ويستخدم الإحالة أو
   طلب التوضيح عند الحاجة.
4. **مقاومة الهلوسة** — عند غياب المرجع الكافي أو انخفاض الثقة، تكون الأولوية
   للامتناع أو التحفظ أو الإحالة، لا لتوليد إجابة غير موثقة.
5. **الجودة الدعوية** — تراعى خلفية المخاطَب، ومستواه، ولغته، وسياقه، ويقدم الأصل
   قبل الفرع، ويجمع بين صحة المعلومة ووضوحها وحسن عرضها دون اختزال مخل.
6. **الترجمة والتوطين** — تحافظ الترجمة على المعنى الشرعي للمصطلح، وتراعي السياق
   الثقافي دون تغيير المضمون لإرضاء توقعات الجمهور.
7. **الشفافية** — يفصح الحل عن طبيعته بوصفه أداة مدعومة بالذكاء الاصطناعي عندما
   يحتمل أن يفهم المستخدم أنه يتعامل مع مختص بشري.
8. **الخصوصية** — لا تجمع بيانات شخصية أو حساسة إلا بقدر الحاجة وبسياسة معلنة،
   ولا تستخدم لتكوين استنتاجات دعوية أو دينية غير لازمة عن المستخدم.

### What Rfeeq already enforces, and what is new

Criteria 1–4 overlap almost exactly with rules already in
`apps/web/src/lib/agentic-search/corpus-prompts.ts` and with the render-time
check in `apps/web/src/lib/verify-quotes.ts`:

| Criterion | Enforced where |
| --- | --- |
| ١ الموثوقية والإسناد | the allow-list at the socket; the publisher-host re-check in `mcp/documents.ts`; `verify-quotes.ts` at render; `<retrieval>` and `<sacred_text>` |
| ٢ التمييز بين القطعي والاجتهادي | `<disagreement>`; `asksDisagreement` routing; the level (ج) contract |
| ٣ عدم الاستقلال بالفتوى | the four exclusion contracts below |
| ٤ مقاومة الهلوسة | ungraded hadith dropped in the adapter; empty-result tools return `{empty, searched}` and instruct abstention |
| ٥ الجودة الدعوية | `<audience>` — الأصل قبل الفرع, shortest correct form first, correct a misconception without rebuke, do not mirror hostility |
| ٦ الترجمة والتوطين | `lib/rfeeq/terms.ts` injects the triggered term's own ضابط; `terminology` can now search موسوعة الجمهرة |
| ٧ الشفافية | `<transparency>` |
| ٨ الخصوصية | three-field profile, policy at `/about#privacy` with explicit consent, no stored inference |

An earlier version of this file recorded criteria 5–8 as having "no
counterpart". That is no longer true: `lib/rfeeq/prompt.ts` carries all four,
and criterion 3 has been strengthened from "do not invent the rule" to "do not
issue the ruling" — in four distinct forms.

### The four scope exclusions

Page 2 excludes four things, not one, and the first draft of this system guarded
only the first:

> ولا يدخل في النطاق إصدار الفتوى الشخصية المستقلة، أو **الحكم على الأشخاص
> والجماعات**، أو **معالجة النزاعات الخاصة**، أو **بناء أحكام شرعية على وقائع
> فردية غير متحققة**.

Each is a limit on the **speech act**, not a topic ban: the general material is
still owed to the reader and only the particular judgement is withheld. All four
route to level (د) — `routing.exclusion` in `lib/rfeeq/intent.ts` — and each has
its own contract in `EXCLUSIONS` in `prompt.ts` and its own reader-facing notice
in `components/rfeeq/chat/answer.tsx`.

| Exclusion | Trigger | What the answer does |
| --- | --- | --- |
| `personal-case` | an own-case marker, or a first-person marker with a decision request | declares it will not rule, gives the general information, refers |
| `persons-groups` | a verdict word **and** a particular person or group | declares it does not judge persons or groups, gives the doctrinal ضوابط, refers the application to qualified scholars. Never attaches a name to a verdict, by implication or example |
| `private-dispute` | a dispute between parties | declines to adjudicate — it hears one side and verifies no fact — gives the general rules, refers |
| `hypothetical` | a supposed case **and** a ruling request | states that the ruling follows the fact, gives the مناط and the conditions, declines to rule on the supposition |

`persons-groups` outranks `personal-case` when both fire: «هل أبي كافر؟» is both,
and the graver exclusion governs. The exclusion is on the **verdict**, not the
topic — «ما ضوابط التكفير عند أهل السنة؟» is a doctrinal question the brief
approves answering, and a regression test holds that line.
