import type { FormattedChunk } from "@/lib/agentic-search/format-chunk";

import type { QueryVariant } from "./query-expansion";
import { citationAllowed } from "./allowlist";
import { expandQuery } from "./query-expansion";

/**
 * Domain-locked web search over approved sites that publish no usable API.
 *
 * This is what covers `fiqh`, `aqida`, `sira-history`, `shubuhat` and `dawa` —
 * the domains where open-ended questions actually land, and where the approved
 * platforms are websites rather than APIs.
 *
 * The lock is real, which is the whole point. OpenAI's `web_search` accepts
 * `filters.allowed_domains` and applies it server-side: the search action
 * reports `domains: null`, meaning the restriction is not passed through the
 * query for a model to rewrite. Measured against the alternative — Gemini's
 * `googleSearch` grounding strips a `site:` operator even when instructed in
 * the strongest terms the API allows, and grounds on whatever it finds, YouTube
 * included. One is an allow-list; the other is a request.
 *
 * Runs as its own model call rather than as a tool on the main loop, so the
 * surface stays provider-independent: the answering model may be Gemini or
 * GPT, and this sub-call is OpenAI either way.
 *
 * One honest limitation. The APIs return records — a hadith *with* its grading,
 * a verse in its canonical orthography. This returns the model's extraction
 * from a page it opened. The link is real, taken from the citation annotations
 * and never from text the model wrote, and the domain is enforced; but the
 * passage is a rendering, not a record. Chunks from here carry
 * `metadata.extracted` so that difference stays legible downstream.
 */

/** Responses API shapes, narrowed to what is read here. */
interface UrlCitation {
  type?: string;
  url?: string;
  title?: string;
  /** Character offsets into `output_text`; the anchor excerpts are cut from. */
  start_index?: number;
  end_index?: number;
}

interface ResponsePayload {
  error?: { message?: string } | null;
  output?: {
    type?: string;
    content?: { text?: string; annotations?: UrlCitation[] | null }[];
  }[];
}

/**
 * What the sub-agent is asked to produce.
 *
 * Verbatim excerpts, each followed immediately by its citation. The brief
 * requires source text to be distinguishable from generated explanation, and a
 * summary cited as though it were a retrieved passage erases exactly that line
 * — so the tool asks for quotation and says why.
 *
 * The *parsing*, though, does not depend on this being obeyed. See
 * `excerptsFor`.
 */
const INSTRUCTIONS = `أنت باحث يبحث في مواقع محدّدة مسموح بها فقط.

لكل صفحة تفتحها وتجد فيها ما يخدم السؤال:
- انقل منها اقتباسًا حرفيًا، فقرة كاملة دون اختصار ودون إعادة صياغة.
- **ضع الاقتباس بين الوسمين <q> و </q>**، ولا تضع داخلهما إلا نصّ الصفحة حرفيًا: لا رقمًا تسلسليًا، ولا تمهيدًا مثل «من صفحة كذا»، ولا تعليقًا بعده.
- ثم استشهد بالصفحة مباشرةً بعد </q>.

قواعد ملزمة:
- انقل الاقتباس حرفيًا كما ورد في الصفحة. لا تُعِد صياغته ولا تلخّصه.
- ما كان خارج <q> … </q> فهو كلامك أنت ولن يُنقل عن الصفحة، فاجعل كل ما يُنسب إليها داخلهما.
- لا تكتب من معرفتك شيئًا. إن لم تجد في المواقع المسموح بها ما يخدم السؤال، فاكتب: لا توجد نتائج.
- لا تكتب روابط بنفسك؛ اكتفِ بالاستشهاد بالصفحات التي فتحتها فعلًا.
- لا تُرجّح بين الأقوال ولا تُصدر حكمًا؛ انقل ما في الصفحات فقط.`;

/** A paragraph's worth — the most a single citation can stand behind. */
const MAX_LOOKBACK = 900;

/**
 * The page's own words, with the researcher's narration dropped.
 *
 * A source card showed «2. من صفحة الموسوعة الحديثية الخاصة بابن باز: "إذا أفطر
 * أحدُكم…"» — the enumerator and the lead-in are the search model talking, and a
 * card that prints them is presenting generated prose as retrieved text. The
 * brief's whole point about sources is that the two stay distinguishable.
 *
 * Extracted by a delimiter the instructions ask for rather than by recognising
 * the narration, because narration has no fixed shape — «فيما يلي ما وجدتُه»,
 * «صفحة أخرى بمنهجية موازية», a bare «2.» — while a tag either is there or is
 * not. Quotation marks were the obvious alternative and are not usable: Arabic
 * quotation nests, so the outer `"` of a citation closes on the `»` of the matn
 * inside it, and the extract stops mid-sentence.
 *
 * Falls back to the whole span when the model ignores the tag. That keeps a
 * non-compliant run answerable instead of empty, and such a chunk still carries
 * `metadata.extracted`, which is what marks this provenance as weaker than an
 * API's.
 */
export const quotedOnly = (span: string) => {
  const quotes = [...span.matchAll(/<q>([\s\S]*?)<\/q>/gu)]
    .map((match) => (match[1] ?? "").trim())
    .filter((quote) => quote.length >= 20);
  if (quotes.length > 0) return quotes.join("\n\n");

  /*
   * An opened tag with no close: the span was cut at the citation marker, which
   * sits immediately after the quotation the model was in the middle of.
   */
  const opened = span.indexOf("<q>");
  if (opened !== -1) {
    const tail = span.slice(opened + 3).replace(/<\/?q>/g, "").trim();
    if (tail.length >= 20) return tail;
  }

  // no tag at all — the model wrote prose, and `extracted` already says so
  return span.replace(/<\/?q>/g, "").trim();
};

/**
 * A short, stable id for a page.
 *
 * Derived from the URL so the same page is the same document across variants,
 * and short because the model has to copy it verbatim into a citation tag — a
 * full URL with query parameters invites a transcription error that resolves to
 * nothing.
 */
const pageId = (url: string) => {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = (Math.imul(31, hash) + url.charCodeAt(i)) | 0;
  }
  const host = new URL(url).host.replace(/^www\./, "").replace(/\./g, "-");
  return `web-${host}-${(hash >>> 0).toString(36)}`;
};

/**
 * The model's own statement that it found nothing.
 *
 * When it opens with «لا توجد نتائج …» and then cites a page anyway, the
 * sentence is its commentary, not the page's content — attributing it to the
 * page would put words in a source that does not contain them, which is the
 * first thing criterion 1 forbids. Taking the model at its word and dropping
 * the excerpt is the correct reading.
 */
const DISCLAIMER = /لا\s*(?:توجد|يوجد)\s*نتائج|لم\s*أجد|لا\s*تتوفر/;

interface Citation {
  url: string;
  title: string;
  start: number;
  end: number;
}

/**
 * A page title fit to show, or null.
 *
 * Some approved pages are generated from Word or PDF and carry titles like
 * `(Microsoft Word - ‎الرسالة‎)` with the encoding mangled. A citation card
 * headed by that tells the reader nothing and looks broken, so the host stands
 * in instead — which at least names the publisher.
 */
const usableTitle = (title: string) => {
  const trimmed = title.trim();
  if (trimmed.length < 3) return null;
  if (/microsoft word|\.docx?\b|\.pdf\b|untitled/i.test(trimmed)) return null;

  /*
   * Mostly unreadable rather than mostly text. Counted rather than matched with
   * a control-character class, which the linter rejects for good reason: the
   * escape sequences that make a title unreadable are usually literal
   * backslashes in the page's own title tag, not real control bytes.
   */
  const unreadable = [...trimmed].filter(
    (character) => character === "\\" || character.codePointAt(0)! < 0x20,
  ).length;
  if (unreadable > trimmed.length / 4) return null;

  /*
   * Mojibake: Arabic encoded as windows-1256 and decoded as latin-1, which is
   * how some older approved pages declare their title. It arrives as a run of
   * accented Latin — `ÔæÇÆÈ ÇáÊÝÓíÑ` is `شوائب التفسير` — so it passes every
   * check above while being unreadable to the one person it is for. Detected as
   * high-latin characters with no Arabic anywhere to balance them.
   */
  const highLatin = [...trimmed].filter((character) => {
    const code = character.codePointAt(0)!;
    return code >= 0xc0 && code <= 0xff;
  }).length;
  const hasArabic = /[\u0600-\u06ff]/.test(trimmed);
  if (!hasArabic && highLatin > trimmed.length / 4) return null;

  return trimmed;
};

/** Strips the markup the model wraps around a quoted passage. */
const tidy = (excerpt: string) =>
  excerpt
    .replace(/^#+\s.*$/gm, "") // a heading the model added
    .replace(/^>\s?/gm, "") // blockquote markers
    .replace(/\(\[[^\]]*\]\([^)]*\)\)/g, "") // inline ([site](url)) markers
    .replace(/\s+/g, " ")
    .replace(/^["“«\s]+|["”»\s]+$/g, "")
    .trim();

/**
 * The passage each citation stands behind.
 *
 * Anchored to the annotation's character offsets rather than to any formatting
 * the model was asked for. Asking for `### title` / `> quote` blocks works
 * perhaps half the time; the offsets are reported by the API and are always
 * there. The annotated span is the inline link markup itself, so the passage is
 * the text *preceding* it, back to wherever the previous citation ended.
 *
 * This is the same technique the neighbouring wosoul project arrived at, for
 * the same reason: a link must point at the page a passage actually came from,
 * and only the citation offsets establish that pairing.
 */
const excerptsFor = (text: string, citations: Citation[]) => {
  const ordered = [...citations].sort((a, b) => a.start - b.start);
  const out: { citation: Citation; excerpt: string }[] = [];
  let cursor = 0;

  for (const citation of ordered) {
    /*
     * Bounded lookback, not everything since the last citation.
     *
     * The model often opens with a sentence of framing before its first
     * quotation, and an unbounded span swept that up as though the source had
     * said it. A citation stands behind the passage immediately before it; a
     * paragraph's worth is the most that can honestly be attributed.
     */
    const from = Math.max(cursor, citation.start - MAX_LOOKBACK);
    const excerpt = quotedOnly(tidy(text.slice(from, citation.start)));
    cursor = Math.max(cursor, citation.end);

    // too short to be a passage: the model cited the same page twice in a row,
    // or wrote a bare link. Nothing to attribute, so nothing is attributed.
    if (excerpt.length < 40) continue;
    if (DISCLAIMER.test(excerpt)) continue;
    out.push({ citation, excerpt });
  }
  return out;
};

export interface WebSearchResult {
  chunks: FormattedChunk[];
  /** Hosts a citation came from, after the audit. For reporting. */
  hosts: string[];
  /** Citations dropped because the server-side filter did not hold. */
  rejected: string[];
}

/**
 * Searches the approved domains for one query.
 *
 * Returns nothing rather than something unsourced: a run that yields no
 * citation from an allowed host produces no chunks, which leaves the answer
 * with nothing to cite — the outcome criterion 4 asks for.
 */
export const searchApprovedWeb = async (
  query: string,
  domains: string[],
  /*
   * Passed in rather than read from `@/env` here. Importing the validated env
   * pulls in every extended schema — Stripe, Pinecone, storage — so a unit test
   * of Arabic citation handling failed to collect on a missing payments key.
   * The caller has the env; this module only needs the string.
   */
  apiKey?: string,
): Promise<WebSearchResult> => {
  if (!apiKey || domains.length === 0) {
    return { chunks: [], hosts: [], rejected: [] };
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1",
      instructions: INSTRUCTIONS,
      input: query,
      tools: [{ type: "web_search", filters: { allowed_domains: domains } }],
      tool_choice: "auto",
    }),
    // a web search runs several fetches of its own; generous, but bounded
    signal: AbortSignal.timeout(90_000),
  });

  if (!response.ok) {
    throw new Error(`web_search failed: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as ResponsePayload;
  if (payload.error) {
    throw new Error(payload.error.message ?? "web_search failed");
  }

  /*
   * Citations, never model-written URLs.
   *
   * The annotations record the pages the tool actually opened. A URL the model
   * types into its answer is a guess, and a guessed link under a real-looking
   * quotation is worse than no link — it is an attribution to a page that may
   * not contain the text.
   */
  const cited: Citation[] = [];
  const rejected: string[] = [];

  for (const item of payload.output ?? []) {
    if (item.type !== "message") continue;
    for (const content of item.content ?? []) {
      for (const annotation of content.annotations ?? []) {
        if (annotation.type !== "url_citation" || !annotation.url) continue;

        // the audit: the server-side filter is the control, this proves it held
        if (!citationAllowed(annotation.url, domains)) {
          rejected.push(annotation.url);
          continue;
        }
        cited.push({
          url: annotation.url,
          title: annotation.title ?? "",
          start: annotation.start_index ?? 0,
          end: annotation.end_index ?? 0,
        });
      }
    }
  }

  if (cited.length === 0) return { chunks: [], hosts: [], rejected };

  /*
   * Assembled from the message contents, not read off `output_text`.
   *
   * `output_text` is a convenience the OpenAI SDK computes client-side; the
   * REST response has no such field. Reading it over HTTP yields undefined, the
   * text is empty, every citation offset points past the end of it, and the
   * search silently returns nothing — which is how this was found.
   */
  const text = (payload.output ?? [])
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .map((content) => content.text ?? "")
    .join("");
  const chunks = excerptsFor(text, cited).map(
    ({ citation, excerpt }, index) => {
      const host = new URL(citation.url).host;
      /*
       * The *page* is the document, so two excerpts from one page are two
       * chunks of one source rather than two sources. The sources panel groups
       * by `documentId`, and minting one per excerpt listed the same page eight
       * times under eight identical titles — which is what it looked like.
       */
      const documentId = pageId(citation.url);

      return {
        id: `${documentId}#${index}`,
        documentId,
        text: excerpt,
        metadata: {
          // the site, so a citation reads as "الدرر السنية" rather than as the
          // name of the mechanism that fetched it
          source: host,
          title: usableTitle(citation.title) ?? host,
          sourceUrl: citation.url,
          // so a reader sees which approved site this came from at a glance
          site: host,
          /*
           * This passage is the model's extraction from the cited page, not a
           * byte-exact record from an API. Weaker provenance than
           * `hadeethenc`'s graded hadith or `quranenc`'s canonical text, and
           * flagged so nothing downstream treats the two as equivalent.
           */
          extracted: true,
        },
      } satisfies FormattedChunk;
    },
  );

  return {
    chunks,
    hosts: [...new Set(cited.map((entry) => new URL(entry.url).host))],
    rejected,
  };
};

/* ---------- query understanding, then fan-out ---------- */

/** Arabic normalisation, for comparing two passages — never for display. */
const normalise = (text: string) =>
  text
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[آأإا]/g, "ا")
    .replace(/[ىي]/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();

export interface ExpandedSearchResult extends WebSearchResult {
  /** The phrasings actually searched, for the answer to be able to say so. */
  variants: QueryVariant[];
}

/**
 * The full retrieval step: understand the question, then search several ways.
 *
 * One query matches one kind of page. The approved domains are two kinds — a
 * fiqh encyclopedia indexed by chapter heading, and fatwa sites titled as
 * questions — so a single phrasing reaches roughly half of what is there. The
 * variants are shaped to reach both, and the reader's own wording is kept among
 * them as the hedge.
 *
 * Searches run concurrently because they are independent and each takes seconds;
 * run in sequence this would be the slowest thing in the answer. `allSettled`
 * rather than `all`: one variant failing is a thinner result, not a failed
 * retrieval.
 */
export const searchApprovedWebExpanded = async (
  question: string,
  domains: string[],
  apiKey?: string,
  { maxVariants = 5, maxChunks = 12 } = {},
): Promise<ExpandedSearchResult> => {
  if (!apiKey || domains.length === 0) {
    return { chunks: [], hosts: [], rejected: [], variants: [] };
  }

  const variants = (await expandQuery(question, apiKey)).slice(0, maxVariants);

  const settled = await Promise.allSettled(
    variants.map((variant) =>
      searchApprovedWeb(variant.query, domains, apiKey),
    ),
  );

  /* collected per variant first, so the cap below can keep them in balance */
  const perVariant: FormattedChunk[][] = variants.map(() => []);
  const hosts = new Set<string>();
  const rejected: string[] = [];
  /*
   * Dedupe on the page *and* the passage. Variants overlap by design — that is
   * what makes the fan-out worth running — so the same paragraph comes back
   * more than once, and a reader seeing one source listed four times learns
   * nothing from the repetition. The prefix identifies a passage without
   * treating two different excerpts from one page as duplicates.
   */
  const seen = new Set<string>();
  /** Excerpts kept per page, so chunk ids stay unique within a document. */
  const perDocument = new Map<string, number>();

  settled.forEach((result, index) => {
    if (result.status !== "fulfilled") return;
    const variant = variants[index];

    for (const host of result.value.hosts) hosts.add(host);
    rejected.push(...result.value.rejected);

    for (const chunk of result.value.chunks) {
      // metadata is arbitrary JSON; only a string is a usable dedupe key
      const raw = chunk.metadata?.sourceUrl;
      const url = typeof raw === "string" ? raw : "";
      const key = `${url}::${normalise(chunk.text).slice(0, 80)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      /*
       * `documentId` is deliberately untouched: it identifies the page, and two
       * variants finding the same page found one source, not two. Only the
       * chunk id is made unique, by its position within that page.
       */
      const position = (perDocument.get(chunk.documentId) ?? 0) + 1;
      perDocument.set(chunk.documentId, position);

      perVariant[index]?.push({
        ...chunk,
        id: `${chunk.documentId}#${position}`,
        metadata: {
          ...chunk.metadata,
          foundBy: variant?.shape,
          query: variant?.query,
        },
      });
    }
  });

  /*
   * Interleaved, not concatenated, before the cap.
   *
   * Taking the first N in variant order spends every slot on the first one or
   * two phrasings, which throws away the reason for searching several ways at
   * all. Round-robin keeps the cap spread across phrasings, so what survives it
   * reflects all of them.
   */
  const chunks: FormattedChunk[] = [];
  for (let rank = 0; chunks.length < maxChunks; rank++) {
    const row = perVariant.map((list) => list[rank]).filter(Boolean);
    if (row.length === 0) break;
    chunks.push(
      ...(row.slice(0, maxChunks - chunks.length) as FormattedChunk[]),
    );
  }

  return {
    chunks,
    hosts: [...hosts],
    rejected,
    variants,
  };
};
