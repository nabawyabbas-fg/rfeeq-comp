/**
 * The retrieval allow-list, enforced rather than described.
 *
 * The challenge brief's binding constraint is one sentence:
 *
 *   A claim the system makes must be traceable to something on this page;
 *   material outside it may not be used as evidence, however reliable it looks.
 *
 * That is a constraint a prompt cannot keep. A model asked to "only search
 * approved sites" will comply almost always, and the one time it does not there
 * is no record and no way to prove it did not. So the rule lives at the only
 * place it can be enforced: the function that opens the socket. Every outbound
 * retrieval request passes through `assertAllowed`, and a host that is not on
 * this list throws before any bytes leave.
 *
 * This is also why Google Search grounding is not used for retrieval. Its whole
 * value is reaching the open web, and there is no point at which a host can be
 * refused — the model's query is a request, not a restriction.
 *
 * Transcribed from `docs/competition/approved-sources.md`. Adding a host here is
 * a scholarly decision, not a technical one: it means asserting that the
 * platform is on the challenge's approved list.
 */

/** Which domain of the allow-list a host serves, for provenance on a citation. */
export type SourceDomain =
  | "quran"
  | "hadith"
  | "terminology"
  | "tafsir"
  | "fiqh"
  | "dawa"
  | "reference";

interface AllowedHost {
  host: string;
  domain: SourceDomain;
  /** What the brief approves it for, quoted where it is short enough to quote. */
  note: string;
}

/**
 * Hosts the brief approves, with the domain each one answers for.
 *
 * Only hosts actually reachable and used are listed. The brief approves more
 * platforms than appear here — `dorar.net`, `shamela.ws`, `binbaz.org.sa`,
 * `islamqa.info` among them — and each needs its own adapter before being
 * added, because being allowed is not the same as being integrated. Listing a
 * host we cannot yet read from would make the allow-list a wish rather than a
 * check.
 *
 * One exception is worth stating plainly, because it is the one case where this
 * function is not the only gate. Two approved publishers are read over MCP, and
 * an MCP request goes to the publisher's gateway rather than to the page: the
 * connection opens to `mcp.islamiccontent.org`, and the document that comes
 * back was published at `hadeethenc.com`. `assertAllowed` cannot see that
 * second hop. So the gateways are admitted by their own closed list — the
 * `SERVERS` table in `mcp/client.ts`, three lines long and equally deliberate —
 * and every document they return has its publisher host checked against *this*
 * list before it can become a citation. Two gates, each guarding what it can
 * actually see.
 */
const ALLOWED: AllowedHost[] = [
  {
    host: "quranenc.com",
    domain: "quran",
    note: "موسوعة القرآن الكريم — النص المعتمد وترجمات معاني القرآن بأكثر من 80 لغة",
  },
  {
    host: "quranpedia.net",
    domain: "quran",
    note: "موسوعة القرآن — أسماء السور وبياناتها، ضمن ما تعتمده الحزمة للقرآن",
  },
  {
    host: "hadeethenc.com",
    domain: "hadith",
    note: "موسوعة الأحاديث النبوية — أحاديث بدرجاتها وتخريجها وشروحها",
  },
  {
    host: "terminologyenc.com",
    domain: "terminology",
    note: "موسوعة المصطلحات الإسلامية — التعريف والشرح والمقابلات المعتمدة",
  },
  /*
   * The next three are the publisher hosts that the approved MCP servers cite.
   * They are here because a document arriving over MCP is checked against this
   * list by the host it was *published* at, which is the only provenance a
   * reader can act on — see `mcp/documents.ts`.
   */
  {
    host: "islamenc.com",
    domain: "quran",
    note: "موسوعة المحتوى الإسلامي باللغات — صفحات الآيات بالنص المعتمد وترجماته",
  },
  {
    host: "islamcontent.com",
    domain: "reference",
    note: "موسوعة المحتوى الإسلامي باللغات — المادة الدعوية والتعليمية المصنّفة",
  },
  {
    host: "tafsir.net",
    domain: "tafsir",
    note: "مركز تفسير للدراسات القرآنية — التفاسير وعلوم القرآن",
  },
  {
    host: "islamic-content.com",
    domain: "terminology",
    note: "موسوعة الجمهرة — مفردات المحتوى الإسلامي، تُقدَّم على الترجمة التلقائية في المصطلحات الحسّاسة",
  },
  {
    host: "risala.prh.gov.sa",
    domain: "reference",
    note: "رسالة الحرمين — محتوى إرشادي معتمد من رئاسة الشؤون الدينية للحرمين",
  },
];

const BY_HOST = new Map(ALLOWED.map((entry) => [entry.host, entry]));

export class NotAllowedError extends Error {
  constructor(host: string) {
    super(
      `Refusing to retrieve from "${host}": not on the challenge's approved-source list. ` +
        `See docs/competition/approved-sources.md.`,
    );
    this.name = "NotAllowedError";
  }
}

/**
 * Throws unless the URL's host is approved.
 *
 * Matches the host exactly rather than by suffix. `endsWith(".quranenc.com")`
 * would also accept `quranenc.com.attacker.example`, and a check that can be
 * walked around is not a check.
 */
export const assertAllowed = (url: string | URL): AllowedHost => {
  const { host, protocol } = url instanceof URL ? url : new URL(url);

  // Plain http would let a network position rewrite scripture in transit, which
  // is the one thing this system must not allow to happen quietly.
  if (protocol !== "https:") {
    throw new NotAllowedError(`${host} (over ${protocol})`);
  }

  const entry = BY_HOST.get(host);
  if (!entry) throw new NotAllowedError(host);
  return entry;
};

/** True when the host is approved. For reporting, not for gating. */
export const isAllowed = (url: string) => {
  try {
    assertAllowed(url);
    return true;
  } catch {
    return false;
  }
};

export const allowedHosts = () => ALLOWED.map((entry) => entry.host);

/* ---------- searchable domains ---------- */

/**
 * Approved domains a web search may be restricted to, by intent.
 *
 * A second allow-list, for a second mechanism. The hosts above are platforms we
 * call directly; these are sites with no usable API that a search tool can
 * nonetheless be *locked to* — OpenAI's `web_search` accepts
 * `filters.allowed_domains` and enforces it server-side, so the restriction
 * holds where a prompt-level `site:` does not.
 *
 * That distinction was measured, not assumed. Gemini's `googleSearch` grounding
 * strips a `site:` operator even under the most explicit instruction and
 * grounds wherever it likes — see `docs/competition/retrieval.md`. OpenAI's
 * filter returns citations only from the listed domains.
 *
 * Every entry is from the domain table in `approved-sources.md`. The lists are
 * per intent because the brief approves different material for different
 * subjects: a fiqh question may read the fatwa bodies, a shubuhat question may
 * not.
 */
const SEARCH_DOMAINS: Record<string, string[]> = {
  /*
   * The hadith row of the allow-list: الصحيحان، dorar.net/hadith، and the
   * approved editions in المكتبة الشاملة. Deliberately not islamqa.info, which
   * carries graders' rulings too but is approved under the *fiqh* row — the
   * allow-list is per domain, and a site being useful is not the same as a site
   * being approved for this subject.
   *
   * Needed because `hadeethenc` holds only authenticated reports, so a weak or
   * fabricated one is simply absent from it. Dorar's الموسوعة الحديثية carries
   * those *with* their gradings, and its قسم الأحاديث المنتشرة التي لا تثبت is
   * the negative-evidence set that turns "not found" into "known not to be
   * established" — which is the difference between an unhelpful silence and an
   * answer.
   */
  hadith: ["dorar.net", "shamela.ws"],
  fiqh: [
    "dorar.net",
    "islamqa.info",
    "binbaz.org.sa",
    "binothaimeen.net",
    "shamela.ws",
    "bohoth.awqaf.gov.kw",
    /*
     * رسالة الحرمين — approved guidance from the Haramain religious presidency,
     * and the only approved source aimed squarely at the rites. Listed under
     * fiqh rather than behind an intent of its own because that is where the
     * brief puts the rites; a question about الحج answered from general fiqh
     * alone misses material written for exactly that reader in eighty
     * languages.
     */
    "risala.prh.gov.sa",
  ],
  aqida: ["dorar.net", "shamela.ws", "binbaz.org.sa", "binothaimeen.net"],
  "sira-history": ["dorar.net", "shamela.ws"],
  /*
   * بيّنات is the brief's named primary source here — «تعد مصدرًا أساسيًا
   * للحلول الحوارية في الشبهات» — and it lives at `dawa.center/file/7937`. A
   * domain filter cannot be narrowed to one path, so the host is listed and the
   * tool description names the resource; the alternative was to leave the
   * brief's primary source reachable only by luck.
   */
  shubuhat: ["dawa.center", "byenah.com", "islamhouse.com"],
  dawa: ["dawa.center", "islamhouse.com", "islamic-content.com"],
  tafsir: ["dorar.net", "tafsir.net", "quranpedia.net"],
  /*
   * موسوعة الجمهرة, which the brief ranks *above* automatic translation for
   * sensitive terms — «يقدم على الترجمة التلقائية في المصطلحات الشرعية
   * الحساسة». It was reachable from the دعوة and شبهات intents and not from
   * this one, which is the only intent it actually governs, so the one
   * authority the criterion names could never be read on the questions it was
   * named for. `terminologyenc.com` is listed alongside it because its own REST
   * adapter is addressed by id and cannot be searched by phrase.
   */
  terminology: ["islamic-content.com", "terminologyenc.com"],
  /*
   * اللغة العربية والمعاجم. The brief approves مجمع الملك سلمان for exactly
   * this — معجم الرياض and سوار, «يُفاد منها في ضبط المصطلح العربي ومقابلاته» —
   * and الدرر السنية's encyclopedias include اللغة العربية among them. الجمهرة
   * stays in the list because a word's اصطلاحي sense and its لغوي one are
   * usually wanted together.
   */
  language: [
    "ksaa.gov.sa",
    "dictionary.ksaa.gov.sa",
    "siwar.ksaa.gov.sa",
    "dorar.net",
    "islamic-content.com",
    "terminologyenc.com",
  ],
};

/** The domains an intent's web search may be locked to; empty if none. */
export const searchDomainsFor = (intent: string): string[] =>
  SEARCH_DOMAINS[intent] ?? [];

/**
 * Checks a citation's host against the domains the search was locked to.
 *
 * The server-side filter is the control; this is the audit. A citation from
 * somewhere else means the filter did not hold, and the honest response is to
 * drop the citation rather than to trust that it could not have happened.
 */
export const citationAllowed = (url: string, domains: string[]) => {
  try {
    const { host, protocol } = new URL(url);
    if (protocol !== "https:") return false;
    return domains.some(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
};
