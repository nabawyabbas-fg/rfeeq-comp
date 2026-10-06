import {
  citationAllowed,
  searchDomainsFor,
} from "@/lib/rfeeq/sources/allowlist";
import {
  searchApprovedWeb,
  searchApprovedWebExpanded,
} from "@/lib/rfeeq/sources/web-search";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The domain-locked web search is the newest and least forgiving piece: it
 * attributes a passage to a page, and a wrong attribution is the failure the
 * brief names first. These cover the parts that decide that attribution.
 */

/** Builds a Responses-API payload with citations at real offsets. */
const payloadFor = (
  text: string,
  citations: { url: string; title: string; at: string }[],
) => ({
  output: [
    { type: "web_search_call", content: [] },
    {
      type: "message",
      content: [
        {
          type: "output_text",
          text,
          annotations: citations.map((c) => ({
            type: "url_citation",
            url: c.url,
            title: c.title,
            start_index: text.indexOf(c.at),
            end_index: text.indexOf(c.at) + c.at.length,
          })),
        },
      ],
    },
  ],
});

const respondWith = (payload: unknown) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(payload),
      } as Response),
    ),
  );

afterEach(() => vi.unstubAllGlobals());

describe("the per-intent search allow-list", () => {
  it("gives the five uncovered domains their approved sites", () => {
    for (const intent of [
      "fiqh",
      "aqida",
      "sira-history",
      "shubuhat",
      "dawa",
    ]) {
      expect(searchDomainsFor(intent).length).toBeGreaterThan(0);
    }
  });

  it("accepts a subdomain of an approved host", () => {
    // old.binothaimeen.net is what the search actually returns
    expect(
      citationAllowed("https://old.binothaimeen.net/x", ["binothaimeen.net"]),
    ).toBe(true);
  });

  it("refuses a lookalike and plain http", () => {
    expect(
      citationAllowed("https://dorar.net.evil.example/x", ["dorar.net"]),
    ).toBe(false);
    expect(citationAllowed("http://dorar.net/x", ["dorar.net"])).toBe(false);
  });
});

describe("attributing a passage to the page it came from", () => {
  const MARKER = "([dorar.net](https://dorar.net/feqhia/1))";

  it("takes the passage immediately before the citation", async () => {
    const text = `يجوز للمسافر الجمع بين الصلاتين تقديمًا وتأخيرًا، وهو قول جمهور العلماء.${MARKER}`;
    respondWith(
      payloadFor(text, [
        {
          url: "https://dorar.net/feqhia/1",
          title: "الموسوعة الفقهية",
          at: MARKER,
        },
      ]),
    );

    const { chunks } = await searchApprovedWeb(
      "الجمع",
      ["dorar.net"],
      "test-key",
    );
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.text).toContain("يجوز للمسافر الجمع");
    // the inline link markup is not part of the passage
    expect(chunks[0]?.text).not.toContain("dorar.net]");
    expect(chunks[0]?.metadata?.sourceUrl).toBe("https://dorar.net/feqhia/1");
  });

  /*
   * The brief's first rule is that nothing may be attributed to a reference it
   * is not in. The model's own "I found nothing" is its commentary, not the
   * page's content.
   */
  it("drops an excerpt that is the model saying it found nothing", async () => {
    const text = `لا توجد نتائج في المواقع المسموح بها حول هذه المسألة.${MARKER}`;
    respondWith(
      payloadFor(text, [
        {
          url: "https://dorar.net/feqhia/1",
          title: "الدرر السنية",
          at: MARKER,
        },
      ]),
    );

    const { chunks } = await searchApprovedWeb(
      "الجمع",
      ["dorar.net"],
      "test-key",
    );
    expect(chunks).toHaveLength(0);
  });

  /*
   * The server-side filter is the control; this is the audit. If it ever fails,
   * the citation must be discarded rather than trusted.
   */
  it("discards and reports a citation from outside the lock", async () => {
    const off = "([x](https://youtube.com/watch?v=1))";
    const text = `كلام منقول عن مصدر غير مسموح به.${off}`;
    respondWith(
      payloadFor(text, [
        { url: "https://youtube.com/watch?v=1", title: "YouTube", at: off },
      ]),
    );

    const { chunks, rejected } = await searchApprovedWeb(
      "x",
      ["dorar.net"],
      "test-key",
    );
    expect(chunks).toHaveLength(0);
    expect(rejected).toEqual(["https://youtube.com/watch?v=1"]);
  });

  it("marks these passages as extracted, not as canonical records", async () => {
    const text = `نصٌّ طويل بما يكفي لأن يُعدَّ فقرةً مقتبسةً من الصفحة المذكورة.${MARKER}`;
    respondWith(
      payloadFor(text, [
        { url: "https://dorar.net/feqhia/1", title: "الدرر", at: MARKER },
      ]),
    );

    const { chunks } = await searchApprovedWeb("x", ["dorar.net"], "test-key");
    // weaker provenance than an API record, and flagged so nothing downstream
    // treats the two as equivalent
    expect(chunks[0]?.metadata?.extracted).toBe(true);
    // the publisher, not the mechanism: a reader weighs a citation by who said
    // it, and every web result was labelled "Approved-web" before this
    expect(chunks[0]?.metadata?.source).toBe("dorar.net");
  });

  /*
   * Some approved pages are generated from Word, or declare their title in
   * windows-1256 and have it decoded as latin-1. Either way the card is headed
   * by something unreadable, which looks broken and names nothing — the host at
   * least names the publisher.
   */
  it.each([
    ["mojibake", "ÔæÇÆÈ ÇáÊÝÓíÑ Ýí ÇáÞÑä ÇáÑÇÈÚ ÚÔÑ ÇáåÌÑí"],
    ["a Word artefact", "(Microsoft Word - risala.doc)"],
  ])("falls back to the host for %s titles", async (_label, title) => {
    const marker = "([dorar.net](https://dorar.net/feqhia/9))";
    const text = `نصٌّ مقتبسٌ من الصفحة فيه كلامٌ كافٍ ليُعدَّ فقرةً صالحةً للعرض.${marker}`;
    respondWith(
      payloadFor(text, [
        { url: "https://dorar.net/feqhia/9", title, at: marker },
      ]),
    );

    const { chunks } = await searchApprovedWeb("x", ["dorar.net"], "test-key");
    expect(chunks[0]?.metadata?.title).toBe("dorar.net");
  });

  it("keeps a real Arabic title", async () => {
    const marker = "([dorar.net](https://dorar.net/feqhia/9))";
    const text = `نصٌّ مقتبسٌ من الصفحة فيه كلامٌ كافٍ ليُعدَّ فقرةً صالحةً للعرض.${marker}`;
    respondWith(
      payloadFor(text, [
        {
          url: "https://dorar.net/feqhia/9",
          title: "الدرر السنية - الموسوعة الفقهية",
          at: marker,
        },
      ]),
    );

    const { chunks } = await searchApprovedWeb("x", ["dorar.net"], "test-key");
    expect(chunks[0]?.metadata?.title).toBe("الدرر السنية - الموسوعة الفقهية");
  });

  /*
   * Two excerpts from one page are two chunks of one source, not two sources.
   * Minting a documentId per excerpt listed the same page eight times under
   * eight identical titles, which is exactly what the panel showed.
   */
  it("treats several excerpts from one page as one source", async () => {
    const m1 = "([dorar.net](https://dorar.net/feqhia/9))";
    const m2 = "([dorar.net](https://dorar.net/feqhia/9))";
    const text =
      `الفقرة الأولى من الصفحة وفيها كلامٌ كافٍ للطول المطلوب.${m1}\n\n` +
      `الفقرة الثانية من الصفحة نفسها وفيها كلامٌ آخر كافٍ للطول.${m2}`;
    const at = text.indexOf(m1);
    respondWith({
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text,
              annotations: [
                {
                  type: "url_citation",
                  url: "https://dorar.net/feqhia/9",
                  title: "الدرر",
                  start_index: at,
                  end_index: at + m1.length,
                },
                {
                  type: "url_citation",
                  url: "https://dorar.net/feqhia/9",
                  title: "الدرر",
                  start_index: text.lastIndexOf(m2),
                  end_index: text.lastIndexOf(m2) + m2.length,
                },
              ],
            },
          ],
        },
      ],
    });

    const { chunks } = await searchApprovedWeb("x", ["dorar.net"], "test-key");
    expect(chunks.length).toBeGreaterThan(1);
    // one page, one document — the panel groups by documentId
    expect(new Set(chunks.map((c) => c.documentId)).size).toBe(1);
  });

  it("returns nothing when no citation survives", async () => {
    respondWith(payloadFor("لا شيء هنا.", []));
    const { chunks, hosts } = await searchApprovedWeb(
      "x",
      ["dorar.net"],
      "test-key",
    );
    expect(chunks).toHaveLength(0);
    expect(hosts).toHaveLength(0);
  });
});

/* ---------- query understanding and the fan-out ---------- */

/** One message payload, with optional citations at real offsets. */
const message = (
  text: string,
  citations: { url: string; title: string; at: string }[] = [],
) => ({
  output: [
    {
      type: "message",
      content: [
        {
          type: "output_text",
          text,
          annotations: citations.map((c) => ({
            type: "url_citation",
            url: c.url,
            title: c.title,
            start_index: text.indexOf(c.at),
            end_index: text.indexOf(c.at) + c.at.length,
          })),
        },
      ],
    },
  ],
});

/**
 * Stubs the two call shapes this path makes: one expansion, then one search per
 * variant. Dispatches on the model, which is what distinguishes them.
 */
const stubPipeline = (
  expansion: string,
  perSearch: (query: string) => unknown,
) =>
  vi.stubGlobal(
    "fetch",
    vi.fn((_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body) as { model: string; input: string };
      const payload = body.model.includes("mini")
        ? message(expansion)
        : perSearch(body.input);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(payload),
      } as Response);
    }),
  );

const EXPANSION = [
  "masala: الجمع بين الصلاتين في السفر",
  "fatwa: هل يجوز الجمع في السفر؟",
  "technical: جواز الجمع للمسافر",
  "evidence: أدلة الجمع في السفر",
].join("\n");

describe("query understanding feeds the search", () => {
  it("keeps the reader's wording and adds one variant per shape", async () => {
    stubPipeline(EXPANSION, () => message("لا شيء."));
    const { variants } = await searchApprovedWebExpanded(
      "س",
      ["dorar.net"],
      "k",
    );

    expect(variants.map((v) => v.shape)).toEqual([
      "original",
      "masala",
      "fatwa",
      "technical",
      "evidence",
    ]);
    // the rewrites are a bet that the sources phrase it differently; the
    // reader's own wording is the hedge against that bet
    expect(variants[0]?.query).toBe("س");
  });

  it("falls back to the question alone when the rewrite fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_u: string, init: { body: string }) => {
        const body = JSON.parse(init.body) as { model: string };
        if (body.model.includes("mini")) {
          return Promise.resolve({ ok: false, status: 500 } as Response);
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(message("لا شيء.")),
        } as Response);
      }),
    );

    // a degraded search beats an error: the question still gets searched
    const { variants } = await searchApprovedWebExpanded(
      "س",
      ["dorar.net"],
      "k",
    );
    expect(variants).toHaveLength(1);
    expect(variants[0]?.shape).toBe("original");
  });

  it("drops the same passage when two phrasings both find it", async () => {
    const marker = "([dorar.net](https://dorar.net/feqhia/1))";
    const text = `يجوز للمسافر الجمع بين الصلاتين تقديمًا وتأخيرًا عند الجمهور.${marker}`;
    // every variant returns the identical page and passage
    stubPipeline(EXPANSION, () =>
      message(text, [
        { url: "https://dorar.net/feqhia/1", title: "الدرر", at: marker },
      ]),
    );

    const { chunks } = await searchApprovedWebExpanded("س", ["dorar.net"], "k");
    expect(chunks).toHaveLength(1);
  });

  /*
   * The reason for searching several ways is lost if the cap spends every slot
   * on the first phrasing.
   */
  it("spreads the cap across phrasings rather than filling it from the first", async () => {
    stubPipeline(EXPANSION, (query) => {
      // each variant finds three distinct passages on its own page
      const host = `https://dorar.net/${encodeURIComponent(query)}`;
      const parts = [1, 2, 3].map((n) => {
        const marker = `([dorar.net](${host}/${n}))`;
        return {
          marker,
          text: `نصٌّ مقتبسٌ رقم ${n} من صفحةٍ تخص «${query}» وفيه كلامٌ كافٍ للطول.${marker}`,
        };
      });
      return message(
        parts.map((p) => p.text).join("\n\n"),
        parts.map((p, i) => ({
          url: `${host}/${i + 1}`,
          title: `صفحة ${i + 1}`,
          at: p.marker,
        })),
      );
    });

    const { chunks } = await searchApprovedWebExpanded(
      "س",
      ["dorar.net"],
      "k",
      {
        maxChunks: 5,
      },
    );

    expect(chunks).toHaveLength(5);
    // five slots over five phrasings: one each, not three from the first
    expect(new Set(chunks.map((c) => c.metadata?.foundBy)).size).toBe(5);
  });
});
