"use client";

import type { EvidenceKind, Proof } from "@/lib/rfeeq/evidence";
import type { ReactNode } from "react";
import { asTable, EVIDENCE_LABEL } from "@/lib/rfeeq/evidence";

import { cn } from "@agentset/ui/cn";

/**
 * الأدلة, as the specification shapes it.
 *
 * Two or more proofs become a table headed by the masʾala; one becomes an
 * ordered item. The threshold is the specification's — «دليلان على الأقل،
 * وإلا تُعرض الأدلة بالترتيب» — and it is a real distinction rather than a
 * styling preference: a table exists to let the reader compare, and a
 * single-row table claims a comparison that is not there.
 *
 * The rows arrive already ordered قرآن ← سنة ← إجماع ← قياس. That ordering is
 * scholarship rather than presentation — it is the evidentiary hierarchy, and a
 * table that led with qiyās would misrepresent how the ruling was reached — so
 * it is decided in `evidence.ts`, not here.
 *
 * The table's own type, cell and rule styles come from `ANSWER_PROSE`, which
 * already dresses `table`, `th` and `td` for the answer body — its comment
 * names «الدليل / وجه الاستدلال / المصدر» as the case it was written for. What
 * this file adds is the parts that are specific to evidence: the masʾala
 * caption, the type tag, and the colour.
 */

/**
 * Each type in its own colour, as literal classes.
 *
 * The tokens are `--rf-t-q` through `--rf-t-k`, ported with the rest of the
 * palette from the approved prototype and unused until now — these four rows
 * are what they were reserved for. Written out rather than composed, because a
 * class assembled at runtime is invisible to Tailwind and would compile to
 * nothing at all.
 */
const TONE: Record<EvidenceKind, { tag: string; edge: string }> = {
  quran: { tag: "text-rf-q bg-rf-q/12", edge: "border-s-rf-q" },
  sunnah: { tag: "text-rf-s bg-rf-s/12", edge: "border-s-rf-s" },
  ijma: { tag: "text-rf-i bg-rf-i/12", edge: "border-s-rf-i" },
  qiyas: { tag: "text-rf-k bg-rf-k/12", edge: "border-s-rf-k" },
};

type Prose = (body: string) => ReactNode;

/** The type's tag, which is how a reader tells a verse from an analogy. */
const Tag = ({ kind }: { kind: EvidenceKind }) => (
  <span
    className={cn(
      "font-rf-ui mb-1 inline-block rounded-[3px] px-1.5 py-px",
      "text-[11.5px] font-semibold",
      TONE[kind].tag,
    )}
  >
    {EVIDENCE_LABEL[kind]}
  </span>
);

/**
 * The proof text, through the answer's own prose pipeline.
 *
 * So a verse inside a row keeps the muṣḥaf treatment it would have anywhere
 * else, and an unverified quotation is still flagged. A row is a container; it
 * does not get its own opinion about how revealed text looks.
 */
const Body = ({ proof, prose }: { proof: Proof; prose: Prose }) => (
  <>
    <Tag kind={proof.kind} />
    {prose(proof.text)}
  </>
);

/** A row's citation, rendered by the same marker the rest of the answer uses. */
const Cite = ({ proof, prose }: { proof: Proof; prose: Prose }) =>
  proof.ids.length > 0
    ? prose(`<citation ids="${proof.ids.join(",")}"></citation>`)
    : null;

const HEADS = ["العلماء", "الدليل", "وجه الاستدلال", "المصدر"];

function ProofTable({
  issue,
  proofs,
  prose,
}: {
  issue: string | null;
  proofs: Proof[];
  prose: Prose;
}) {
  return (
    /* Its own scroll container: four columns of Arabic will not fit a phone,
       and the answer body must never scroll sideways. */
    <div className="my-3 overflow-x-auto">
      <table>
        {issue ? (
          /* A caption rather than a spanning header row. It is the table's
             heading semantically, and it keeps the masʾala out of the `th`
             styling, which is sized for column labels. */
          <caption
            dir="auto"
            className={cn(
              "border-rf-line font-rf-ui text-rf-text caption-top border-0 border-b",
              "pb-2 text-start text-[14.5px] font-semibold",
            )}
          >
            <span className="text-rf-text-3 font-medium">المسألة: </span>
            {issue}
          </caption>
        ) : null}
        <thead>
          <tr>
            {HEADS.map((head) => (
              <th key={head}>{head}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {proofs.map((proof, index) => (
            <tr
              key={`${proof.kind}-${index}`}
              /* The type's colour on the row's leading edge: one glance says
                 whether a ruling rests on a verse or on an analogy. */
              className={cn("border-s-[3px]", TONE[proof.kind].edge)}
            >
              <td dir="auto" className="ps-2.5">
                {proof.by ?? "—"}
              </td>
              <td dir="auto">
                <Body proof={proof} prose={prose} />
              </td>
              <td dir="auto">{proof.why ?? "—"}</td>
              <td dir="auto">
                {proof.source ?? "—"}
                <Cite proof={proof} prose={prose} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A single proof: an ordered item, not a table.
 *
 * The same four fields, run together under the text, because with one row there
 * is nothing to align them against.
 */
function ProofList({ proofs, prose }: { proofs: Proof[]; prose: Prose }) {
  return (
    /* No list classes of its own. `ANSWER_PROSE` already sets `ol` to a grid
       with its own gap, padding and decimal markers — the numbering the
       prototype's own `evList` uses — and its descendant selectors outrank
       utilities on the element, so anything set here would be dead weight that
       reads as if it were doing something. */
    <ol>
      {proofs.map((proof, index) => (
        <li
          key={`${proof.kind}-${index}`}
          className={cn("border-s-[3px] ps-3", TONE[proof.kind].edge)}
        >
          <div dir="auto">
            <Body proof={proof} prose={prose} />
          </div>
          <div
            dir="auto"
            className="font-rf-ui text-rf-text-2 mt-1 flex flex-wrap items-center gap-x-2 text-[13.5px]"
          >
            {[proof.by, proof.why, proof.source]
              .filter((value): value is string => Boolean(value))
              .map((value) => (
                <span key={value}>{value}</span>
              ))}
            <Cite proof={proof} prose={prose} />
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Evidence({
  issue,
  proofs,
  prose,
}: {
  issue: string | null;
  proofs: Proof[];
  prose: Prose;
}) {
  if (proofs.length === 0) return null;
  return asTable(proofs) ? (
    <ProofTable issue={issue} proofs={proofs} prose={prose} />
  ) : (
    <ProofList proofs={proofs} prose={prose} />
  );
}
