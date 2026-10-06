import { normalise } from "./normalise";

/**
 * Evidence as data rather than as prose.
 *
 * The MVP specification gives الأدلة a template of its own, and makes two
 * things explicit that a prose section cannot honour:
 *
 *   «عند وجود دليلين فأكثر تُعرض الأدلة في جدول بدل الأقسام، **في أي مجال
 *    وليس في الفقه وحده**.»
 *   «القرآن ← السنة ← الإجماع ← القياس» — ولكل نوع لونه.
 *
 * Both are claims about *structure*. A table appears at two proofs and not at
 * one; the rows are ordered by the evidentiary hierarchy and not by the order
 * the model happened to find them in; each type is recognisable by colour. None
 * of that survives being asked for in a prompt — and the ordering in particular
 * is load-bearing scholarship, not presentation: putting qiyās above a verse
 * misrepresents how the ruling was reached.
 *
 * So the model emits one marker per proof with its parts named, and the
 * ordering, the threshold and the colours are decided here.
 */

/** The four, in the order the specification fixes. */
export type EvidenceKind = "quran" | "sunnah" | "ijma" | "qiyas";

export const EVIDENCE_ORDER: EvidenceKind[] = [
  "quran",
  "sunnah",
  "ijma",
  "qiyas",
];

/** The short tag shown on a row, as the prototype labels it. */
export const EVIDENCE_LABEL: Record<EvidenceKind, string> = {
  quran: "قرآن",
  sunnah: "سنة",
  ijma: "إجماع",
  qiyas: "قياس",
};

/**
 * What a model might write for the type, folded.
 *
 * Arabic first because that is what the instruction asks for, with the English
 * keys accepted too — a model that writes `t="sunnah"` has named the right
 * thing and should not lose its row over the language it named it in.
 */
const KINDS: { kind: EvidenceKind; terms: string[] }[] = [
  { kind: "quran", terms: ["القرآن", "قرآن", "كتاب", "اية", "quran"] },
  { kind: "sunnah", terms: ["السنة", "سنة", "حديث", "اثر", "sunnah", "hadith"] },
  { kind: "ijma", terms: ["الإجماع", "إجماع", "اتفاق", "ijma", "consensus"] },
  { kind: "qiyas", terms: ["القياس", "قياس", "qiyas", "analogy"] },
];

/** Reads a type name, or null when it is none of the four. */
export const evidenceKind = (value: string | null): EvidenceKind | null => {
  if (!value?.trim()) return null;
  const text = normalise(value).toLowerCase();
  for (const { kind, terms } of KINDS) {
    if (terms.some((term) => text.includes(normalise(term).toLowerCase()))) {
      return kind;
    }
  }
  return null;
};

export interface Proof {
  kind: EvidenceKind;
  /** العلماء — who argues from it. */
  by: string | null;
  /** الدليل — the proof text itself, as retrieved. */
  text: string;
  /** وجه الاستدلال — how the ruling follows from it. */
  why: string | null;
  /** المصدر — where the proof is recorded. */
  source: string | null;
  /** The chunk ids behind it, for the citation. */
  ids: string[];
}

/*
 * One marker per proof, everything but the proof text in attributes.
 *
 * Attributes rather than nested markers: the two long fields are الدليل and
 * وجه الاستدلال, and only the first is long enough to want a body. Arabic text
 * does not use ASCII double quotes — scripture is delimited with ﴿﴾ and «» —
 * so the attribute values are safe unescaped, which is what makes this
 * single-marker shape workable at all.
 */
const EV = /<ev\b([^>]*?)\/?>([\s\S]*?)(?:<\/ev\s*>|(?=<ev\b)|$)/gi;

const attr = (attrs: string, names: string[]) => {
  for (const name of names) {
    const quoted = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i").exec(attrs);
    if (quoted?.[1]?.trim()) return quoted[1].trim();
    const bare = new RegExp(`\\b${name}\\s*=\\s*([^\\s"'>]+)`, "i").exec(attrs);
    if (bare?.[1]?.trim()) return bare[1].trim();
  }
  return null;
};

/**
 * Reads the proofs out of an evidence section, in the hierarchy's order.
 *
 * A proof with no recognisable type is dropped rather than guessed at: the row
 * colour and the sort position both encode which of the four it is, and a row
 * placed by guesswork would assert a position in the hierarchy that nothing
 * said. A proof with no text is dropped for the simpler reason that there is
 * nothing to show.
 *
 * The sort is stable within a type, so two ḥadīth proofs keep the order the
 * model gave them — which is usually the order the sources list them in.
 */
export const parseProofs = (body: string): Proof[] => {
  const proofs: Proof[] = [];
  EV.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = EV.exec(body)) !== null) {
    const attrs = match[1] ?? "";
    const kind = evidenceKind(attr(attrs, ["t", "type", "kind"]));
    const text = (match[2] ?? "").trim();
    if (!kind || !text) continue;

    proofs.push({
      kind,
      by: attr(attrs, ["by", "who", "scholars"]),
      text,
      why: attr(attrs, ["why", "wajh", "reason"]),
      source: attr(attrs, ["src", "source", "ref"]),
      ids: (attr(attrs, ["ids", "id", "cite"]) ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    });
  }

  return proofs
    .map((proof, index) => ({ proof, index }))
    .sort(
      (a, b) =>
        EVIDENCE_ORDER.indexOf(a.proof.kind) -
          EVIDENCE_ORDER.indexOf(b.proof.kind) || a.index - b.index,
    )
    .map(({ proof }) => proof);
};

/**
 * The threshold the specification sets: «دليلان على الأقل، وإلا تُعرض الأدلة
 * بالترتيب».
 *
 * One proof is a statement; a table of one row is a table pretending the
 * comparison it exists to support is there.
 */
export const asTable = (proofs: Proof[]) => proofs.length > 1;

/** What the model is told to emit. Stated once, used by every template. */
export const EVIDENCE_BRIEF =
  "كل دليل في وسم مستقل، ولا تكتبها جدولًا ولا قائمة بنفسك:\n" +
  '  <ev t="القرآن|السنة|الإجماع|القياس" by="من استدل به" why="وجه الاستدلال" src="المصدر" ids="معرّفات المقاطع">نص الدليل</ev>\n' +
  "  t نوع الدليل، وهو مطلوب — والدليل بلا نوع يُطرح.\n" +
  "  نص الدليل داخل الوسم: الآية بين ﴿﴾ والحديث بين «»، منقولًا من المقطع لا من حفظك.\n" +
  "  الترتيب والألوان والجدولة يبنيها النظام، فلا ترتّب ولا تُرقّم.";
