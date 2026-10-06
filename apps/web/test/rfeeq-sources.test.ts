import {
  allowedHosts,
  assertAllowed,
  isAllowed,
  NotAllowedError,
} from "@/lib/rfeeq/sources/allowlist";
import { toChunk } from "@/lib/rfeeq/sources/mcp/documents";
import { getTerm } from "@/lib/rfeeq/sources/terminology";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The allow-list is the challenge's one binding constraint on retrieval, so it
 * is tested as a security boundary rather than as a helper: what it lets
 * through, and — more importantly — what it does not.
 */
describe("the approved-source allow-list", () => {
  it("admits the approved platforms", () => {
    for (const host of allowedHosts()) {
      expect(isAllowed(`https://${host}/api/v1/thing`)).toBe(true);
    }
  });

  it("refuses a host that is not approved", () => {
    expect(() => assertAllowed("https://example.com/hadith")).toThrow(
      NotAllowedError,
    );
  });

  /*
   * A suffix check — `host.endsWith("quranenc.com")` — would admit this. The
   * assertion matches the host exactly for that reason.
   */
  it("cannot be walked around with a lookalike host", () => {
    expect(isAllowed("https://quranenc.com.attacker.example/api")).toBe(false);
    expect(isAllowed("https://notquranenc.com/api")).toBe(false);
    expect(isAllowed("https://evil.example/?x=quranenc.com")).toBe(false);
  });

  /*
   * Scripture arriving over plain http could be rewritten in transit by anyone
   * on the path, which is the one corruption this system must not pass on
   * quietly.
   */
  it("refuses plain http even for an approved host", () => {
    expect(isAllowed("http://quranenc.com/api/v1/x")).toBe(false);
  });

  it("refuses sources the brief approves but we have not integrated", () => {
    // dorar.net and shamela.ws are on the brief's list; adding a host here is
    // a claim that an adapter exists and has been checked, not that the
    // platform is permitted in principle
    expect(isAllowed("https://dorar.net/dorar_api.json")).toBe(false);
    expect(isAllowed("https://shamela.ws/book/1")).toBe(false);
  });
});

/** Stubs one JSON response from the network. */
const respondWith = (body: unknown) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(body),
      } as Response),
    ),
  );
};

afterEach(() => vi.unstubAllGlobals());

/**
 * A document as the approved publishers' content servers return it.
 *
 * The servers hand back segments already separated by what may be done with
 * each — `exact` is published text to be reproduced verbatim, `attribution` is
 * a name or a grading, `commentary` is the publisher's own prose. These
 * fixtures are trimmed copies of real responses.
 */
const hadithDocument = {
  id: "hadith:4560:ar",
  title: "إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى",
  text: "…",
  url: "https://hadeethenc.com/ar/browse/hadith/4560",
  segments: [
    {
      kind: "exact",
      text: "«إِنَّمَا الْأَعْمَالُ بِالنِّيَّةِ، وَإِنَّمَا لِامْرِئٍ مَا نَوَى»",
    },
    { kind: "attribution", label: "Narrator", text: "متفق عليه" },
    { kind: "attribution", label: "Grade", text: "صحيح" },
  ],
  metadata: {
    source: "HadeethEnc",
    hadith_id: "4560",
    language: "ar",
    grade: "صحيح",
    attribution: "متفق عليه",
  },
};

describe("hadith: no citation without a grading", () => {
  it("carries the grading and the attribution into the citation", () => {
    const chunk = toChunk(hadithDocument);

    expect(chunk).not.toBeNull();
    expect(chunk?.metadata?.grade).toBe("صحيح");
    expect(chunk?.metadata?.attribution).toBe("متفق عليه");
    // the publisher, never the protocol that fetched it
    expect(chunk?.metadata?.source).toBe("hadeethenc");
    expect(chunk?.metadata?.sourceUrl).toBe(
      "https://hadeethenc.com/ar/browse/hadith/4560",
    );
  });

  /*
   * The brief's rule for this domain, in code:
   * «لا ينسب حديث دون مصدر وحكم معتمد في البيانات».
   *
   * Enforced at the adapter rather than in the prompt, so no amount of prompt
   * drift can surface an ungraded report as evidence. The answer is then left
   * with nothing to quote, which criterion 4 says is the correct outcome.
   */
  it.each([
    ["no grading", { grade: "" }],
    ["no attribution", { attribution: "" }],
    ["neither", { grade: "", attribution: "" }],
    ["a whitespace grading", { grade: "   " }],
  ])("refuses to build a citation with %s", (_label, override) => {
    const document = {
      ...hadithDocument,
      metadata: { ...hadithDocument.metadata, ...override },
    };
    expect(toChunk(document)).toBeNull();
  });

  it("keeps the publisher's explanation out of the quotable text", () => {
    const chunk = toChunk({
      ...hadithDocument,
      segments: [
        ...hadithDocument.segments,
        {
          kind: "commentary",
          label: "Explanation",
          text: "يُبَيِّنُ النبيُّ صلى الله عليه وسلم أنَّ كل الأعمال معتبرة بالنية",
        },
      ],
    });

    // the matn is what may be quoted; a modern gloss must not be quotable as
    // though it were the Prophet's words
    expect(chunk?.text).not.toContain("يُبَيِّنُ");
    expect(chunk?.metadata?.explanation).toContain("يُبَيِّنُ");
  });

  /*
   * The same hadith read in Arabic and in English is one source, so the two
   * must collapse to one card in the sources panel rather than appearing as
   * two independent witnesses.
   */
  it("gives one document id regardless of the language read", () => {
    const arabic = toChunk(hadithDocument);
    const english = toChunk({
      ...hadithDocument,
      id: "hadith:4560:en",
      metadata: { ...hadithDocument.metadata, language: "en" },
    });

    expect(arabic?.documentId).toBe("hadeethenc-4560");
    expect(english?.documentId).toBe(arabic?.documentId);
  });
});

/**
 * The second hop the allow-list cannot see.
 *
 * A request goes to the publisher's gateway and the document that comes back
 * names its own source page. The gateway being approved does not make
 * everything reachable through it approved, so the publisher host is checked
 * before a document can become a citation.
 */
describe("provenance: the publisher host is re-checked", () => {
  it("drops a document published off the allow-list", () => {
    expect(
      toChunk({
        ...hadithDocument,
        url: "https://example.com/hadith/4560",
      }),
    ).toBeNull();
  });

  it("drops one served over plain http", () => {
    expect(
      toChunk({
        ...hadithDocument,
        url: "http://hadeethenc.com/ar/browse/hadith/4560",
      }),
    ).toBeNull();
  });
});

describe("qurʾān: the canonical text is passed through untouched", () => {
  const uthmani =
    "ٱدۡعُ إِلَىٰ سَبِيلِ رَبِّكَ بِٱلۡحِكۡمَةِ وَٱلۡمَوۡعِظَةِ ٱلۡحَسَنَةِۖ";
  const moyassar = "ادعُ -أيها الرسول- أنت ومَنِ اتبعك إلى دين ربك";

  const verseDocument = {
    id: "quran:16:125:ar",
    title: "القرآن الكريم — 16:125",
    text: "…",
    url: "https://islamenc.com/ar/quran/16/125",
    segments: [
      { kind: "exact", text: uthmani },
      { kind: "exact", text: moyassar },
    ],
    metadata: {
      source: "QuranEnc",
      surah: 16,
      aya: 125,
      translation_key: "arabic_moyassar",
      language: "ar",
    },
  };

  it("preserves the ʿUthmānī orthography and diacritics", () => {
    const chunk = toChunk(verseDocument);

    // normalising here would destroy exactly what makes the text canonical
    expect(chunk?.text).toBe(uthmani);
    expect(chunk?.metadata?.sura).toBe(16);
    expect(chunk?.metadata?.aya).toBe(125);
    expect(chunk?.metadata?.source).toBe("quranenc");
  });

  /*
   * Both the verse and its rendering arrive as published text, and quoting the
   * rendering as though it were the verse is the specific failure this split
   * prevents — acutely so here, where the "translation" is an Arabic paraphrase
   * that reads like scripture.
   */
  it("keeps the rendering out of the verse", () => {
    const chunk = toChunk(verseDocument);

    expect(chunk?.text).not.toContain("أيها الرسول");
    expect(chunk?.metadata?.translation).toBe(moyassar);
    expect(chunk?.metadata?.translationEdition).toBe("arabic_moyassar");
  });
});

describe("terminology: the approved equivalent, not a translation", () => {
  it("returns the target language's own headword and definition", async () => {
    respondWith({
      id: "649",
      term: "Translation",
      idio_def:
        "Interpreting speech and rendering it from one language to another.",
    });

    const chunk = await getTerm("649", "en");
    expect(chunk?.metadata?.title).toBe("Translation");
    expect(chunk?.metadata?.language).toBe("en");
    // the definition is the citable text — a headword alone is not evidence
    expect(chunk?.text).toContain("Interpreting speech");
  });

  it("ignores an entry the encyclopedia has no record of", async () => {
    respondWith({ id: null, term: null });
    await expect(getTerm("999999", "ar")).resolves.toBeNull();
  });
});
