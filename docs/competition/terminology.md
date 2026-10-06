# Terminology (نماذج لقاموس المصطلحات الأساسية)

The brief's ten sample terms, verbatim. Marked as **نماذج** — samples — so the
full controlled vocabulary comes from `islamic-content.com/dictionary` and
`terminologyenc.com`; these ten show the shape the rules take.

| المصطلح | المقابل الإنجليزي | ضابط الاستخدام |
| --- | --- | --- |
| الإسلام | Islam | دين الاستسلام لله بالتوحيد والانقياد له بالطاعة، ويشرح بحسب السياق ولا يختزل في معنى ثقافي عام. |
| التوحيد | Tawhid / Oneness of God | يفضل إبقاء المصطلح مع شرح معناه: إفراد الله بالربوبية والألوهية ووصفه بما جاء الوحي به من أسمائه الحسنى، ولا يختزل في ترجمة قد توحي بمجرد الوحدانية العددية. |
| العبادة | Worship | تشمل أعمال القلب والقول والعمل التي يتقرب بها العبد إلى الله، ولا تحصر في الشعائر فقط. |
| النبوة | Prophethood | تستخدم للدلالة على اصطفاء الأنبياء بالوحي، مع التمييز بينها وبين القيادة الدينية البشرية. |
| الوحي | Revelation | يشرح بوصفه ما أوحاه الله إلى أنبيائه، مع تجنب استعمالات فضفاضة قد توهم الإلهام الشخصي. |
| الشريعة | Sharia / Islamic law and guidance | يشرح بحسب السياق، ولا يختزل في العقوبات أو القانون الجنائي. |
| الحديث | Hadith | ما نُقل عن النبي ﷺ من قول أو فعل أو تقرير ونحو ذلك، مع بيان درجة الثبوت عند الاستدلال. |
| السنة | Sunnah | هدي النبي ﷺ وطريقته، ويحدد المقصود بحسب السياق العلمي. |
| الفتوى | Fatwa | جواب شرعي يصدره مؤهل في واقعة أو سؤال، ولا يساوى بالمعلومة العامة. |
| الدعوة | Da‘wah / Invitation to Islam | التعريف بالإسلام والدعوة إليه بالحكمة، ويختار المقابل بحسب السياق والجمهور. |

## The pattern in the ضوابط

Every rule here is a **negative** constraint — what the translation must not
collapse into:

| Term | The reduction being guarded against |
| --- | --- |
| الإسلام | a general cultural identity |
| التوحيد | mere numerical oneness |
| العبادة | ritual acts only |
| النبوة | human religious leadership |
| الوحي | personal inspiration |
| الشريعة | penal or criminal law |
| الفتوى | ordinary information |

Two carry an extra positive requirement: **التوحيد** should keep the Arabic term
alongside a gloss rather than be replaced by an English word, and **الحديث**
must carry درجة الثبوت whenever it is used as evidence — which is the same rule
as the hadith sourcing requirement in `approved-sources.md`, arriving from the
terminology side.

The practical consequence for the app: a sensitive term needs a **lookup**, not
a translation. `الفتوى` → `Fatwa` with "a shar‘ī answer issued by a qualified
person on a specific case, not equivalent to general information" is a correct
output; `الفتوى` → `religious ruling` is a failing one, even though any
translation model would produce it.
