# Approved sources (المرجعية العلمية المعتمدة)

The retrieval allow-list for the challenge. A claim the system makes must be
traceable to something on this page; material outside it may not be used as
evidence, however reliable it looks.

Transcribed from `spec/` (pages 3–4 for the domain rules, 8–15 for the
platforms). Quantities are as the platforms published them at the brief's date
and are expected to drift.

## Domain → approved content → usage rule

| المجال | المحتوى المعتمد | قاعدة الاستخدام |
| --- | --- | --- |
| الموضوعات الدعوية والمحتوى الإسلامي | المستودع الدعوي الرقمي `dawa.center` · موسوعة مفردات المحتوى الإسلامي (الجمهرة) `islamic-content.com` | مرجعان شاملان. يوصى بالرجوع إليهما فيما يحتاج إليه في الدعوة إلى الله من الموضوعات والمصطلحات، والدعوة حسب البلدان، والأديان، واللغات، والفئات. |
| القرآن الكريم | النص القرآني بالرسم والنص المعتمد، مع ترجمات معتمدة لكل لغة مستخدمة (طبعة مجمع الملك فهد أو ترجماته أو الواردة في `quranpedia.net`) | أهمية التأكد من موثوقية نقل الآيات. |
| التفسير | أي مصادر إسلامية في القرون الثلاثة الأولى، أو `dorar.net/tafseer` | يستخدم لشرح الآية **مع تمييز كلام المفسر عن النص القرآني**. |
| الحديث النبوي | الأحاديث الصحيحة من الصحيحين، وما يضاف من كتب السنة بعد التأكد من صحته إن كان سيعتمد عليه (`dorar.net/hadith`، أو الطبعات المعتمدة لكتب السنة في المكتبة الشاملة `shamela.ws`) | **لا ينسب حديث دون مصدر وحكم معتمد في البيانات.** |
| العقيدة والتعريف بالإسلام | أي مصادر إسلامية في القرون الثلاثة الأولى، أو `dorar.net/aqeeda` | الالتزام بما عليه المسلمون خصوصًا الصحابة والتابعون ومن تبعهم. |
| الفقه العام | أي كتاب معتمد في الفقه على أحد المذاهب الأربعة، أو `dorar.net/feqhia` | **لا تتحول إلى فتوى شخصية أو ترجيح آلي مستقل.** |
| السيرة والتاريخ | أي مصادر إسلامية في القرون الثلاثة الأولى، أو `dorar.net/history` | تعتمد الوقائع الثابتة وتحدد درجة ما يحتاج إلى احتراز. |
| الشبهات والأسئلة المتكررة | بيّنات: أسئلة وأجوبة عن الإسلام `dawa.center/file/7937` | تعد مصدرًا أساسيًا للحلول الحوارية في الشبهات. |
| الترجمة والمصطلحات | موسوعة الجمهرة — مفردات المحتوى الإسلامي `islamic-content.com/dictionary` | يقدم على الترجمة التلقائية في المصطلحات الشرعية الحساسة. |

Three of these rules are machine-checkable and worth building checks for rather
than only prompting: tafsir must separate the mufassir's words from the āya,
hadith must carry a source **and** a grading, and fiqh must not resolve
disagreement on its own.

## جمعية خدمة المحتوى الإسلامي باللغات

Charity producing, organising and freely publishing Islamic content in many
languages. Per its statement of 17 September 2026:

| البند | البيان |
| --- | --- |
| الترخيص | مرخّصة من المركز الوطني لتنمية القطاع غير الربحي، رقم التسجيل 2131 |
| التغطية اللغوية | أكثر من 130 لغة |
| المراجعة والاعتماد | ثلاث مراحل كحد أدنى: ترجمة ← تدقيق لغوي ← مراجعة شرعية واعتماد |
| الإتاحة | مجاني للأفراد والجهات، واجهات برمجية عامة، قاعدة مركزية موحّدة، وخادم MCP |

**MCP server for the first six platforms: `mcp.islamiccontent.org`** — directly
relevant, since the app is already an MCP-capable agentic search client.

| المرجع | المحتوى والبيانات | الإتاحة التقنية |
| --- | --- | --- |
| موسوعة القرآن الكريم | القرآن وتفاسيره وترجمات معانيه؛ نصية وصوتية وجاهزة للطباعة. ترجمات بأكثر من 80 لغة | `quranenc.com` · API `quranenc.com/en/home/api` · stats `stats.quranenc.com` |
| موسوعة الأحاديث النبوية | أحاديث صحيحة مع شروحها وفوائدها وتصنيفها الموضوعي. أكثر من 50 ألف حديث مترجم بأكثر من 70 لغة | `hadeethenc.com` · API `hadeethenc.com/api-docs` · stats `stats.hadeethenc.com` |
| بيان الإسلام | إصدارات للتعريف بالإسلام وتعليمه: كتب ورسائل ومطويات. أكثر من 10000 إصدار بأكثر من 120 لغة | `byenah.com` · API `byenah.com/ar/api` · stats `stats.byenah.com` |
| دار الإسلام | كتب ومقالات وفتاوى وصوتيات ومرئيات مصنّفة موضوعياً. أكثر من 130 لغة، وأكثر من 25 عامًا | `islamhouse.com` · API `documenter.getpostman.com/view/7929737/TzkyMfPc` |
| موسوعة المحتوى الإسلامي باللغات | بطاقات بحقول وجُمَل محددة بمعرّفات موحّدة تربط البطاقة بترجماتها؛ أحاديث، أسئلة وأجوبة، أماكن، أسماء حسنى، مصطلحات، أعلام. أكثر من 100 لغة | `islamenc.com/ar` · REST موثقة على القاعدة المركزية |
| موسوعة المصطلحات الإسلامية | مصطلحات شرعية بتعريف وشرح ومقابلات بعشرات اللغات، مصنّفة في العقيدة والفقه وأصوله والفضائل والآداب والحديث | `terminologyenc.com` |
| القاعدة المركزية للمحتوى | المستودع المركزي للترجمات المعتمدة. **محاذاة على مستوى الجملة** بين الأصل العربي وترجماته، بمعرّفات موحّدة وتضمينات دلالية تتيح الاسترجاع باللفظ والمعنى. أكثر من 30 مليون كلمة معتمدة | `icadb.com` · API `icadb.com/api/docs` |

The central base is the most interesting asset technically: sentence-level
alignment with stable ids and semantic embeddings already built. For any
multilingual requirement it is a better starting point than translating
retrieved Arabic at answer time.

### منصة بالشراكة مع الرئاسة الدينية للحرمين

| المنصة | المحتوى والمراجعة | الإتاحة |
| --- | --- | --- |
| رسالة الحرمين | محتوى إرشادي معتمد من رئاسة الشؤون الدينية للمسجد الحرام والمسجد النبوي، يلبي حاجة قاصدي الحرمين بلغاتهم ويصحح مناسكهم وعباداتهم. مواد مقروءة ومسموعة ومرئية بأكثر من 80 لغة | `risala.prh.gov.sa` |

## المنصات المتخصصة خارج الجمعية

> وتوصي الجمعية بالإفادة من محتوى المنصات الخارجية **دون أن تكون مسؤولة عنه**،
> مع الاعتماد في الترجمات المعتمدة على منصات الجمعية ومنصة رسالة الحرمين.

A ranking rule, not just a disclaimer: for **translated** text the association's
own platforms and رسالة الحرمين outrank everything below.

### القرآن الكريم وعلومه

| المرجع | المحتوى | الإتاحة التقنية |
| --- | --- | --- |
| مركز تفسير للدراسات القرآنية — مؤسسة وقفية بالرياض، 1428هـ/2008م | بحوث محكّمة ودراسات في التفسير وعلوم القرآن، قسم للاستشراق ونقده، تفاسير وأطالس وتحقيقات وترجمات وفهارس ومعاجم. موسوعة التفسير الموضوعي في 36 مجلدًا و365 موضوعًا. أكثر من 180 مصدرًا تفسيريًا، واجهة بأكثر من 20 لغة | `tafsir.net` · `modoee.com` · `surahapp.com` · `wahy.net` · تطبيقات: غريب، الكشاف، بيّنات، مفصّل |
| المكتبة الصوتية للقرآن الكريم | تلاوات لأكثر من 230 قارئًا في نحو 20 رواية، المصحف المعلّم والمجوّد، أكثر من 100 إذاعة قرآنية، بث مباشر | `mp3quran.net` · **API عامة مجانية بلا مفتاح** للقرّاء والروايات والإذاعات **وتوقيتات الآيات**: `mp3quran.net/api` |

### الموسوعات الفقهية والمرجعيات الشرعية

| المرجع | المحتوى | الإتاحة التقنية |
| --- | --- | --- |
| الموسوعة الفقهية الكويتية — وزارة الأوقاف، إدارة البحوث والموسوعات | أوسع موسوعة فقهية معاصرة، مرتبة ألفبائياً على المذاهب الأربعة في 45 مجلدًا، بلغة ميسّرة وتوثيق للمصادر. **مرجع أساسي لضبط المصطلحات الفقهية** | `bohoth.awqaf.gov.kw` · تنزيل كامل Word/PDF · نصيًا في المكتبة الشاملة |
| الإسلام سؤال وجواب — بإشراف الشيخ محمد صالح المنجد، منذ 1997م | فتاوى مؤصّلة بأدلتها ومصنّفة موضوعياً، مترجمة إلى 17 لغة | `islamqa.info` |
| موقع الشيخ عبدالعزيز بن باز — مؤسسة الشيخ الخيرية | مجموع الفتاوى، نور على الدرب، صوتيات الشروح والمحاضرات، كتب ومقالات ورسائل، بتصنيف فقهي وموضوعي | `binbaz.org.sa` |
| موقع الشيخ محمد بن صالح العثيمين — مؤسسة الشيخ الخيرية بعنيزة | كتبه ورسائله، والمكتبة الصوتية من الشروح واللقاءات والفتاوى، مع تفريغاتها | `binothaimeen.net` |

`islamqa.info` is **already in the Rfeeq corpus** — see the fatwa namespace.
That is the one place where existing ingested material lines up with the
allow-list directly.

### اللغة العربية والمعاجم والمصطلحات

| المرجع | المحتوى | الإتاحة التقنية |
| --- | --- | --- |
| مجمع الملك سلمان العالمي للغة العربية | معجم الرياض للغة العربية المعاصرة بمقابلات إنجليزية، مبني على مدونة تناهز 400 مليون كلمة. سوار: أكثر من 20 معجمًا و330 ألف مدخل. فلك: مدونات تتجاوز 1.5 مليار كلمة، بأدوات الكشاف السياقي والتكرارات والمتلازمات | `ksaa.gov.sa` · `dictionary.ksaa.gov.sa` · **سوار + واجهة مطورين** `siwar.ksaa.gov.sa` · `falak.ksaa.gov.sa` |

### بيانات إضافية للمراجع الواردة سابقًا

| المرجع | البيانات الإضافية | الإتاحة التقنية |
| --- | --- | --- |
| مجمع الملك فهد لطباعة المصحف الشريف | تفاسير ومجلة بحوث. **خطوط قرآنية موحّدة (Unicode) لثماني روايات**، ونص المصحف للمطورين بصيغ XML/JSON **بمعرّفات على مستوى الآية والكلمة** | `qurancomplex.gov.sa` · الترجمات `qurancomplex.gov.sa/quran-translations/` · الخطوط `fonts.qurancomplex.gov.sa` · **منصة المطورين** `qurancomplex.gov.sa/quran-dev` |
| الدرر السنية — بإشراف د. علوي بن عبدالقادر السقاف، منذ 1422هـ/2001م | موسوعات محرّرة بتوثيق وإحالة. الموسوعة الحديثية نحو **300 ألف حديث** مع أحكام العلماء وتخريجها، **وقسم للأحاديث المنتشرة التي لا تثبت**. وتشمل أصول الفقه والقواعد الفقهية والأديان والفرق والأخلاق والآداب واللغة | `dorar.net` · **واجهة بحث حديثي JSON** `dorar.net/article/389` |
| المكتبة الشاملة — مشروع غير ربحي، 2005م | نحو 8 آلاف كتاب لنحو 3 آلاف مؤلف، نحو 7 ملايين صفحة. **نصوص مرقّمة موافقة للمطبوع**. النسخ المسماة وما يضاف إليها من كتب غير رسمية لا تتبع المؤسسة | `shamela.ws` · قاعدة البيانات الكاملة `shamela.ws/page/download` |

Two items here are worth singling out:

- **قسم الأحاديث المنتشرة التي لا تثبت** is a negative-evidence set. It makes the
  spec's "رفض اختلاق حديث" testable: a widely circulated but unestablished
  hadith can be *recognised and corrected*, not merely left unfound.
- **معرّفات على مستوى الآية والكلمة** from مجمع الملك فهد give exact verse
  identity. The quote panel added in `scripture-panel.tsx` currently shows the
  quoted span as the model rendered it; with word-level ids it can show the
  canonical text plus sūra and āya instead.

## What we actually reach, and how

The table above is the brief's list. This is what the system opens a connection
to, which is a shorter list — being approved is not the same as being
integrated, and `lib/rfeeq/sources/allowlist.ts` is written to the second.

| Endpoint                       | Operator                           | Carries                                                   |
| ------------------------------ | ---------------------------------- | --------------------------------------------------------- |
| `mcp.islamiccontent.org/mcp`   | the joint encyclopedias            | Qurʾān (`quranenc`), hadith (`hadeethenc`), موسوعة المحتوى |
| `mcp.tafsir.net/mcp`           | مركز تفسير للدراسات القرآنية       | 28 tafsīr editions, علوم القرآن, a Qurʾān concordance      |
| `terminologyenc.com`           | موسوعة المصطلحات الإسلامية         | terms with approved equivalents per language              |

Both MCP endpoints are public, read-only, free, and need no key — which is what
the brief records as «الإتاحة … وخادم MCP». They are **gateways, not sources**:
a request goes to `mcp.islamiccontent.org` and the document it returns was
published at `hadeethenc.com`, `islamenc.com` or `islamcontent.com`. The
allow-list cannot see that second hop, so the gateways are admitted by a closed
list of their own and every document they return has its **publisher host**
re-checked against the allow-list before it can become a citation.

`islamcontent.com` and `islamenc.com` both serve موسوعة المحتوى الإسلامي
باللغات, which the brief lists as `islamenc.com`. They are on the allow-list
because they are the hosts the MCP citations actually point at.

The rest of the brief's platforms — `dorar.net`, `shamela.ws`, `islamqa.info`,
`binbaz.org.sa`, `binothaimeen.net`, `bohoth.awqaf.gov.kw`, `dawa.center`,
`byenah.com`, `tafsir.net`'s own pages — are reached through a web search locked
to their domains server-side, per intent. They publish no usable API, and
`dorar.net` additionally blocks this server at its CDN. See `retrieval.md`.
