/**
 * Query understanding: one question in, several search phrases out.
 *
 * This is where the semantic work lives, now that nothing is ingested. A vector
 * index absorbs the gap between how a reader asks and how a book is written;
 * with live web search there is no index, so the gap has to be closed in the
 * query itself — by asking in the words the sources actually use, in the shapes
 * they are actually titled in.
 *
 * Shape is the point, not paraphrase. The approved domains are two different
 * kinds of thing and they index differently:
 *
 * - `dorar.net`'s موسوعة فقهية and `shamela.ws` are organised by bāb and
 *   masʾala, so a chapter heading retrieves where a question does not —
 *   «المطلب الثاني: الجمع في السفر», not «هل يجوز أن أجمع؟».
 * - `islamqa.info`, `binbaz.org.sa` and `binothaimeen.net` publish one question
 *   per page, titled the way the questioner put it, so the opposite holds.
 *
 * A single query can match one or the other. Several, shaped deliberately,
 * match both — which is the whole reason this stage exists rather than handing
 * the reader's sentence straight to the search.
 *
 * The vocabulary mapping is the same one the corpus prompts already carry
 * (`agentic-search/corpus-prompts.ts`): a reader's "mortgage" is the books'
 * الإجارة المنتهية بالتمليك, and searching the reader's word finds nothing.
 */

/** What a variant is shaped to match. Kept on the result for traceability. */
export type QueryShape =
  | "original"
  | "masala"
  | "fatwa"
  | "technical"
  | "evidence";

export interface QueryVariant {
  shape: QueryShape;
  query: string;
}

/** Cheap and fast: this is a rewrite, not the answer. */
const MODEL = "gpt-4.1-mini";

const INSTRUCTIONS = `أنت تُعيد صياغة سؤال المستخدم إلى عبارات بحث تُطابق طريقة كتابة المصادر الشرعية، لا طريقة سؤال الناس.

أعطِ أربع صياغات، كل واحدة في سطر مستقل، بهذا الترتيب وبهذه البادئات بالضبط:

masala: <عنوان مسألة أو ترجمة باب كما تُكتب في الموسوعات الفقهية — لا سؤال>
fatwa: <عنوان فتوى كما يكتبه موقع فتاوى — صيغة سؤال أو عنوان موضوع>
technical: <المصطلح الفقهي الاصطلاحي للمسألة، بكلمات الفقهاء لا بكلمات السائل>
evidence: <عبارة تبحث عن الأدلة أو الخلاف في المسألة>

قواعد:
- كل صياغة بالعربية الفصيحة، مهما كانت لغة السؤال.
- انقل مقصود السؤال كما هو. لا تُوسّع المسألة ولا تُضيّقها ولا تُبدّل موضوعها.
- لا تُضف أمثلة ولا تفاصيل لم ترد في السؤال؛ الصياغة للبحث لا للإجابة.
- استعمل مصطلح الفقهاء لا كلمة السائل: «الرهن العقاري» → «الإجارة المنتهية بالتمليك، المرابحة للآمر بالشراء»؛ «التأمين» → «التأمين التجاري، الغرر».
- لا تكتب شرحًا ولا ترقيمًا ولا أي شيء غير الأسطر الأربعة.`;

const PREFIXES: Record<string, QueryShape> = {
  masala: "masala",
  fatwa: "fatwa",
  technical: "technical",
  evidence: "evidence",
};

/** Parses the four prefixed lines, ignoring anything else the model wrote. */
const parseVariants = (text: string): QueryVariant[] => {
  const out: QueryVariant[] = [];

  for (const line of text.split("\n")) {
    const match = /^\s*([a-z]+)\s*[:：]\s*(.+?)\s*$/.exec(line);
    const shape = match?.[1] ? PREFIXES[match[1]] : undefined;
    const query = match?.[2]?.trim();

    if (!shape || !query || query.length < 3) continue;
    if (out.some((variant) => variant.shape === shape)) continue;
    out.push({ shape, query });
  }
  return out;
};

/**
 * Expands a question into search phrases.
 *
 * The reader's own wording is always kept as the first variant. The rewrites
 * are a bet that the sources phrase it differently; the original is the hedge
 * against that bet being wrong, and it costs one search.
 *
 * Fails soft on purpose: if the rewrite call errors or returns nothing usable,
 * the search still runs on the question as asked. A degraded search is worth
 * more here than an error.
 */
export const expandQuery = async (
  question: string,
  apiKey?: string,
): Promise<QueryVariant[]> => {
  const original: QueryVariant = { shape: "original", query: question.trim() };
  if (!apiKey) return [original];

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        instructions: INSTRUCTIONS,
        input: question,
        // a rewrite, not a judgement: near-deterministic so the same question
        // searches the same way twice
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) return [original];

    const payload = (await response.json()) as {
      output?: { type?: string; content?: { text?: string }[] }[];
    };
    const text = (payload.output ?? [])
      .filter((item) => item.type === "message")
      .flatMap((item) => item.content ?? [])
      .map((content) => content.text ?? "")
      .join("");

    return [original, ...parseVariants(text)];
  } catch {
    return [original];
  }
};
