"use client";

import type { FormattedChunk } from "@/lib/agentic-search/format-chunk";
import type { DorarRuling } from "@/lib/rfeeq/sources/dorar";
import { gradeTone } from "@/lib/rfeeq/grade";

import { cn } from "@agentset/ui/cn";

import { Icon } from "../icon";

/**
 * تفاصيل الحديث — the rulings passed on one matn, each with who passed it.
 *
 * موسوعة الحديث gives a hadith one grading and one attribution, which is enough
 * to cite it and not enough to study it. الموسوعة الحديثية (الدرر السنية) gives
 * every ruling recorded on the same matn: who narrated it, which muḥaddith
 * ruled on it, the book and page the ruling is in, the verdict in that
 * muḥaddith's own words, and the takhrīj. The brief puts `dorar.net/hadith` in
 * the hadith row for exactly this.
 *
 * Nothing here is written by a model. Every field is a string copied out of
 * Dorar's own ruling block, and a ruling missing either its muḥaddith or its
 * verdict never reaches this component — «لا ينسب حديث دون مصدر وحكم معتمد».
 *
 * The one judgement the panel makes is the colour, and it makes it the way the
 * grading row does: `gradeTone` reads the verdict's words, and a verdict it
 * does not recognise is shown uncoloured and whole rather than forced onto one
 * of the two sides. A reader who disagrees with the colour can still read the
 * word, which is the thing that matters.
 */

/** What the panel needs to show, lifted off the chunk when it is opened. */
export interface HadithDetails {
  matn: string;
  /** موسوعة الحديث's own grading. */
  grade: string | null;
  /** Where that encyclopedia attributes it — «متفق عليه». */
  attribution: string | null;
  rulings: DorarRuling[];
}

const Field = ({ label, value }: { label: string; value?: string }) =>
  value ? (
    <div className="grid grid-cols-[auto_1fr] items-baseline gap-x-2 gap-y-0.5">
      <dt className="text-rf-text-3 text-[13px] whitespace-nowrap">{label}</dt>
      <dd dir="auto" className="text-rf-text-2 min-w-0 text-[14px]/[1.7]">
        {value}
      </dd>
    </div>
  ) : null;

/**
 * One muḥaddith's entry.
 *
 * The narrator leads it, because that is what identifies *which* report this
 * ruling is about — the same words reach us through more than one Companion,
 * and a ruling is on a chain, not on a sentence.
 */
function Ruling({ ruling }: { ruling: DorarRuling }) {
  const tone = gradeTone(ruling.grade);

  return (
    <li className="border-rf-line rounded-rf-md border p-3">
      {ruling.narrator ? (
        <p className="mb-2 flex items-center gap-1.5">
          <Icon
            name="user"
            size="sm"
            className="text-rf-text-3 shrink-0"
            aria-hidden
          />
          <span className="text-rf-text-3 text-[13px]">الراوي</span>
          <span dir="auto" className="text-rf-text text-[15px] font-semibold">
            {ruling.narrator}
          </span>
        </p>
      ) : null}

      <dl className="grid grid-cols-1 gap-1">
        <Field label="المحدّث" value={ruling.muhaddith} />
        <Field label="المصدر" value={ruling.source} />
        <Field label="الصفحة أو الرقم" value={ruling.locus} />
      </dl>

      {ruling.grade ? (
        <p className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="text-rf-text-3 text-[13px]">خلاصة حكم المحدّث</span>
          <span
            className={cn(
              "border-rf-line bg-rf-surface inline-flex items-center gap-1.5",
              "rounded-xl border px-3 py-[3px] text-[14px]/[1.7]",
              tone === "sound" && "text-rf-success",
              tone === "weak" && "text-rf-danger",
              tone === "unknown" && "text-rf-text-2",
            )}
          >
            {tone !== "unknown" ? (
              <span
                aria-hidden
                className={cn(
                  "size-[7px] rounded-full",
                  tone === "sound" ? "bg-rf-success" : "bg-rf-danger",
                )}
              />
            ) : null}
            <span dir="auto">{ruling.grade}</span>
          </span>
        </p>
      ) : null}

      {ruling.takhrij ? (
        <p
          dir="auto"
          className="text-rf-text-2 mt-2 text-[14px]/[1.8] [&_+_*]:mt-0"
        >
          <span className="text-rf-text-3 text-[13px]">التخريج: </span>
          {ruling.takhrij}
        </p>
      ) : null}
    </li>
  );
}

export function HadithPanel({ details }: { details: HadithDetails }) {
  const tone = gradeTone(details.grade);

  return (
    <div className="font-rf-ui grid grid-cols-1 gap-4">
      {/* the matn in the muṣḥaf face, at 16 on a leading of 2 — as in the answer */}
      <blockquote
        dir="rtl"
        lang="ar"
        className="font-rf-matn rf-matn text-rf-matn border-rf-accent text-rf-text border-s-2 ps-3"
      >
        {details.matn}
      </blockquote>

      {details.grade ? (
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className={cn(
              "border-rf-line bg-rf-surface inline-flex items-center gap-1.5",
              "rounded-xl border px-3 py-[3px] text-[14px]/[1.7]",
              tone === "sound" && "text-rf-success",
              tone === "weak" && "text-rf-danger",
              tone === "unknown" && "text-rf-text-2",
            )}
          >
            {tone !== "unknown" ? (
              <span
                aria-hidden
                className={cn(
                  "size-[7px] rounded-full",
                  tone === "sound" ? "bg-rf-success" : "bg-rf-danger",
                )}
              />
            ) : null}
            <span dir="auto">{details.grade}</span>
          </span>
          {details.attribution ? (
            <span dir="auto" className="text-rf-text-2 text-[14.5px]">
              {details.attribution}
            </span>
          ) : null}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-2">
        <h3 className="text-rf-text text-[15px] font-semibold">
          أحكام المحدّثين
        </h3>

        {details.rulings.length > 0 ? (
          <>
            <ul className="grid list-none gap-2 p-0">
              {details.rulings.map((ruling, index) => (
                <Ruling
                  key={`${ruling.muhaddith}-${ruling.source}-${index}`}
                  ruling={ruling}
                />
              ))}
            </ul>
            <p className="text-rf-text-3 text-[13px]/[1.7]">
              المصدر: الموسوعة الحديثية — الدرر السنية.
            </p>
          </>
        ) : (
          /*
           * An empty set is reported, not hidden. Dorar is searched for every
           * hadith this system reads, so "no rulings" means the search found
           * none — which a reader studying a matn needs told, rather than
           * shown a panel that looks as though it was never asked.
           */
          <p className="text-rf-text-2 text-[14px]/[1.8]">
            لم يرد لهذا الحديث حكم في الموسوعة الحديثية بالدرر السنية ضمن ما
            استُرجع.
          </p>
        )}
      </section>
    </div>
  );
}

const str = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/**
 * Lifts a hadith's details off the chunk it was rendered from.
 *
 * Returns null for anything that is not a hadith card — the grading is the test,
 * since `toChunk` refuses to build a hadith chunk without one, so a chunk
 * carrying a grade from the hadith encyclopedia is exactly a hadith.
 *
 * `rulings` is read defensively: it is written by the retrieval layer and
 * travels through the message's stored JSON, so an older conversation reloaded
 * from history has a chunk with no rulings at all. That renders as "none
 * found", which is honest, rather than as a crash.
 */
export const hadithDetailsOf = (
  chunk: FormattedChunk,
): HadithDetails | null => {
  const meta = chunk.metadata ?? {};
  const rulings = Array.isArray(meta.rulings) ? (meta.rulings as DorarRuling[]) : [];

  /*
   * Two ways a chunk is a hadith worth opening.
   *
   * It came from موسوعة الحديث, which refuses to build a hadith chunk without a
   * grading — so a grading is what identifies one. Or it is a Dorar page that
   * yielded rulings, which is the case this pane exists for: a hadith موسوعة
   * الحديث does not hold, carrying nothing *but* the muḥaddiths' verdicts.
   * Requiring a grading there would shut the pane on a disputed matn, which is
   * precisely the one a reader most needs it for.
   */
  const fromEncyclopedia = meta.source === "hadeethenc";
  if (!fromEncyclopedia && rulings.length === 0) return null;

  const grade = str(meta.grade);
  if (fromEncyclopedia && !grade) return null;

  return {
    matn: chunk.text,
    grade,
    attribution: str(meta.attribution),
    rulings,
  };
};
