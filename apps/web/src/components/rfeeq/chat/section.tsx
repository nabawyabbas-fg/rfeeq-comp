"use client";

import type { FormattedChunk } from "@/lib/agentic-search/format-chunk";
import type { RenderSection } from "@/lib/rfeeq/sections";
import type { ReactNode } from "react";
import { Fragment } from "react";
import { parseProofs } from "@/lib/rfeeq/evidence";
import { gradeTone } from "@/lib/rfeeq/grade";
import { sectionAttr } from "@/lib/rfeeq/sections";

import { cn } from "@agentset/ui/cn";

import type { HadithDetails } from "./hadith-panel";
import { hadithDetailsOf } from "./hadith-panel";

import { Evidence } from "./evidence";
import { QuranUsageTable, usageOf } from "./usage";

import { Icon } from "../icon";

/**
 * One answer section, in the shape its template declared.
 *
 * The specification's progressive disclosure, rendered: an expanded section is
 * a heading over its body, a collapsed one is a closed `<details>` the reader
 * opens — and which opens itself when the question asked for it.
 *
 * Deliberately emitted as `h3`, `details` and `summary` rather than as styled
 * divs. `ANSWER_PROSE` in `answer-body.tsx` already dresses all three for
 * exactly this purpose — its own comment names «الأدلة» and «الفوائد» as the
 * collapsible cases — so the approved typography applies by being used rather
 * than by being reproduced. A new set of section classes would have been a
 * second opinion about type the design already settled.
 */

/* ---------- structural sections ---------- */

const str = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const num = (value: unknown) =>
  typeof value === "number"
    ? String(value)
    : typeof value === "string" && value.trim()
      ? value.trim()
      : undefined;

/** Whether a chunk is a Qurʾānic verse, a hadith, or neither. */
export const kindOf = (chunk: FormattedChunk) => {
  const source = str(chunk.metadata?.source);
  if (source === "quranenc" || source === "quranpedia") return "quran" as const;
  if (source === "hadeethenc") return "hadith" as const;
  return null;
};

/**
 * A word of a verse, as a control.
 *
 * A plain string and **not** `cn()`. `cn` is tailwind-merge, which cannot tell
 * a custom `text-<size>` token from a custom `text-<colour>` one — both are
 * bare `text-*` utilities it has no config for — so it treats them as one group
 * and keeps the last. Through `cn` this list silently lost
 * `text-rf-quran-sm` and the words rendered at the browser's button size
 * instead of the Qurʾānic reading size.
 *
 * The hazard is specific: it bites only where two *named* `text-` tokens meet.
 * `text-[15px]` beside `text-rf-success` is fine, because an arbitrary value is
 * recognisable as a size.
 */
const WORD_BUTTON = [
  "font-rf-quran cursor-pointer border-0 bg-transparent p-0 font-normal",
  "text-rf-answer-q text-rf-text hover:text-rf-accent",
  "focus-visible:outline-rf-focus rounded-[3px] outline-none",
  "focus-visible:outline-[2px] focus-visible:outline-offset-1",
].join(" ");

/**
 * The retrieved text, set at reading size.
 *
 * Rendered from the chunk rather than from anything the model wrote, which is
 * the whole reason a section has a `ref`: a verse that arrives through
 * `metadata` is verbatim by construction, and no instruction about reproducing
 * diacritics has to hold for it to stay correct.
 *
 * The delimiters are set apart from the words — ﴿ ﴾ in the muṣḥaf face and the
 * accent colour, the text in the reading face — matching how an inline
 * quotation is treated, so revealed text reads as one vocabulary wherever it
 * appears.
 */
function ScriptureText({
  chunk,
  onOpen,
  onDetails,
  onWord,
}: {
  chunk: FormattedChunk;
  onOpen?: () => void;
  /** Opens تفاصيل الحديث. Present only on a hadith. */
  onDetails?: () => void;
  /** Opens علوم الكلمة for one word of a verse, 1-based. */
  onWord?: (word: number, text: string) => void;
}) {
  const kind = kindOf(chunk) ?? "quran";
  const quranic = kind === "quran";
  const [opening, closing] = quranic ? ["﴿", "﴾"] : ["«", "»"];

  /*
   * The muṣḥaf face is the Qurʾān's, not scripture's in general.
   *
   * v1.10 is explicit that the hadith a question is *about* is set in the
   * answer's own face at 16/2 — «Asked-about hadith: answer-body font, not the
   * Quran font». The earlier treatment gave both the Qurʾānic face on the
   * reasoning that revealed text should read as one vocabulary; the design
   * draws the line one step further in, between the recited word and a
   * narrated one.
   */
  /*
   * The muṣḥaf face, on the hadith too.
   *
   * This reverses v1.10's «Asked-about hadith: answer-body font, not the Quran
   * font» at the owner's instruction. The distinction that note drew — between
   * the recited word and a narrated one — is now carried by the brackets («»
   * against ﴿﴾) and by the type size rather than by the face: a matn is set at
   * 16 on a leading of 2, and a verse at 16 on 50px, so they are still never
   * mistaken for one another on the page.
   *
   * `--font-rf-matn` is **KFGQPC Uthmanic Script HAFS** — خط عثمان طه — self
   * hosted from `public/fonts`. It ships Regular only, so `.rf-matn` carries
   * the weight as a hairline stroke rather than letting the browser
   * synthesise a bold, which on this script runs the tashkīl into the
   * letters. Tune `--rf-matn-weight` in `rfeeq.css`; all three renderers of
   * a matn follow it together.
   */
  /*
   * The size lives on the wrapper, not on the text.
   *
   * The brackets are sized in `em`, and `em` resolves against the parent — so
   * with the size on the *text* span the brackets were measuring themselves
   * against the answer body's 16px while the verse ran at 24. Hoisting it means
   * one declared size that both the glyphs and their brackets share.
   */
  const size = quranic ? "text-rf-answer-q" : "text-rf-matn";

  /*
   * ﴿ ﴾ at 1em, dropped 0.045em.
   *
   * Measured rather than eyeballed, because the bracket and the text come from
   * different faces and nothing about one predicts the other. In Amiri Quran
   * the ornate parenthesis spans em[-0.416, +0.746]; the letters of KFGQPC
   * Uthmanic span em[-0.443, +0.683] across ا ج ل ي ن م ه ك ط ص ض. So at 1em
   * the bracket is already the right height — 1.162em against 1.126em — and the
   * whole error is that its centre sits 0.045em higher than the letters'.
   *
   * It had been `text-[24px]` with `align-middle`: a fixed size that was 1.5×
   * the text it enclosed, and a vertical-align keyed to the parent's x-height,
   * which Arabic does not really have. `vertical-align` with a length is
   * relative to the baseline, which is the one line both faces agree on.
   */
  const bracket = cn(
    "text-rf-accent mx-1 font-normal",
    quranic
      ? "font-rf-mushaf text-[1em] [vertical-align:-0.045em]"
      : "font-rf-matn text-[1.1em] align-baseline",
  );
  /* plain strings: `cn` cannot tell `text-rf-matn` from `text-rf-text` */
  const text = quranic
    ? "font-rf-quran text-rf-text font-normal"
    : "font-rf-matn rf-matn text-rf-text font-normal";

  /*
   * Only a verse's words are tappable, and only when something can answer for
   * them. The centre indexes the Qurʾān word by word — معنى, إعراب, تصريف,
   * قراءات — and indexes nothing of the kind for a matn, so offering the same
   * affordance on a hadith would be a tap that leads nowhere.
   */
  const words =
    kind === "quran" && onWord ? chunk.text.split(/\s+/).filter(Boolean) : null;

  /*
   * A block `span`, not a `p`, for two reasons that both bite.
   *
   * `ANSWER_PROSE` sets `[&_p]:my-0` — a descendant selector, which outranks a
   * `my-3` utility on the element — so as a paragraph the verse had no vertical
   * space at all. And when the whole verse is a quote-panel button, a `p`
   * inside a `button` violates the button's content model, which permits
   * phrasing content only.
   */
  const body = (
    <span
      dir="rtl"
      lang="ar"
      className={cn(
        "my-3 block",
        size,
        /*
         * `text-balance` on the verse only.
         *
         * It equalises line lengths, which is what a short centred verse wants
         * — it settles into a pyramid rather than a long line over a stub. A
         * narration is neither short nor centred, and balancing it *narrows the
         * block*: the browser pulls the measure in until the lines match, so a
         * three-line matn rendered about a hundred pixels short of the column
         * it sits in. It only became visible when the matn took the muṣḥaf
         * face, whose wider glyphs tipped it from two lines to three.
         */
        kind === "quran" ? "text-center text-balance" : "text-pretty",
      )}
    >
      <span className={bracket}>{opening}</span>
      {words ? (
        <span className={text}>
          {words.map((word, index) => (
            <Fragment key={`${index}-${word}`}>
              {/*
               * A real space, not a margin.
               *
               * `<button>` is inline-block and JSX inserts nothing between
               * mapped siblings, so without this the whole verse rendered as
               * one unbroken run — «ٱدۡعُإِلَىٰسَبِيلِ». A text node also keeps
               * the words separated when the reader copies the verse out, which
               * a margin would not.
               */}
              {index > 0 ? " " : null}
              <button
                type="button"
                onClick={(event) => {
                  // the verse behind it opens علوم الآية; a word is the finer
                  // target and must not trigger both
                  event.stopPropagation();
                  onWord?.(index + 1, word);
                }}
                aria-label={`علوم الكلمة: ${word}`}
                className={WORD_BUTTON}
              >
                {word}
              </button>
            </Fragment>
          ))}
        </span>
      ) : (
        <span className={text}>{chunk.text}</span>
      )}
      <span className={bracket}>{closing}</span>
    </span>
  );

  /*
   * Buttons do not nest: when the words are the controls, the verse is not. The
   * āya's own control is its numbered mark — see `AyahMark` — which is where a
   * reader's eye stops anyway, and which a single quoted verse reaches through
   * the «الآية ٤٣» link in the reference row beneath it.
   */
  if (words) return body;

  /*
   * On a hadith the matn opens تفاصيل الحديث rather than an enlargement.
   *
   * The enlargement showed the same words bigger; the details pane shows who
   * narrated it and every muḥaddith's ruling on it — which is what a reader
   * taps a matn to find out, and it opens with the matn at the top, so nothing
   * the enlargement offered is lost.
   */
  const act = onDetails ?? onOpen;
  if (!act) return body;

  const quote = (
    <button
      type="button"
      onClick={act}
      aria-label={
        onDetails
          ? "تفاصيل الحديث"
          : kind === "quran"
            ? "عرض نص الآية"
            : "عرض نص الحديث"
      }
      className={cn(
        "rounded-rf-sm block w-full cursor-pointer border-0 bg-transparent p-0 text-start",
        "hover:bg-rf-accent-soft",
        "focus-visible:outline-rf-focus outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2",
      )}
    >
      {body}
    </button>
  );

  /*
   * The matn is one of the two ways in; the other is the «تفاصيل الحديث» link,
   * which sits at the foot of the answer beside «المصادر» rather than here.
   * That is where the answer's other exits are, beside «المصادر», and a link
   * under every quoted matn would repeat itself on an answer that quotes
   * several.
   */
  return quote;
}

/**
 * Prose with its proofs standing where they were written.
 *
 * «الأدلة» used to be one folded block at the foot of a ruling, holding every
 * proof the answer rested on. For a ruling with one point that reads well; for
 * «ما شروط صحة صيام رمضان» — five conditions, each with its own evidence — it
 * put the verse establishing the time of الإمساك four screens below the
 * sentence it establishes, and left the reader to pair them up by the `why`
 * line. A proof belongs under the claim it proves.
 *
 * So a prose section may carry `<ev>` markers inline, and they render where
 * they sit. Adjacent markers group into one block, which is what keeps the
 * two-proof table threshold and the قرآن ← سنة ← إجماع ← قياس ordering meaning
 * something: they order a point's proofs among themselves, which is the only
 * scope in which that ordering was ever a claim about anything.
 *
 * The markers survive this journey already — `<ev …ids=…>` counts as an
 * attribution to `citesNothing`, and the language gate strips tags before it
 * counts characters — so placing them inline needed no new syntax.
 */
const EVIDENCE_RUN = /(?:\s*<ev\b[\s\S]*?<\/ev>)+/gi;

function ProseWithEvidence({
  body,
  issue,
  prose,
}: {
  body: string;
  issue: string | null;
  prose: (body: string) => ReactNode;
}) {
  const blocks: React.ReactNode[] = [];
  let cursor = 0;

  for (const run of body.matchAll(EVIDENCE_RUN)) {
    const before = body.slice(cursor, run.index);
    if (before.trim()) blocks.push(prose(before));

    const proofs = parseProofs(run[0]);
    if (proofs.length > 0) {
      blocks.push(
        <Evidence
          key={`ev-${run.index}`}
          issue={issue}
          proofs={proofs}
          prose={prose}
        />,
      );
    }
    cursor = run.index + run[0].length;
  }

  const rest = body.slice(cursor);
  if (rest.trim()) blocks.push(prose(rest));

  return <>{blocks}</>;
}

/** ٠-٩ as the muṣḥaf writes them. */
const arabicDigits = (value: number) =>
  String(value).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)] ?? d);

/**
 * The end-of-āya mark, and the control that opens that āya.
 *
 * The number is **overlaid** on U+06DD rather than written after it, because
 * this font composes the two itself: its GSUB carries 56 lookups and not one of
 * them ligates the mark with a digit, so «۝٤» renders as an empty circle with a
 * 4 sitting beside it. The digits are nonetheless drawn for the job — ١ is
 * 0.27em tall against the circle's 0.89em — so they are the muṣḥaf's own
 * numerals at their own size, simply placed where the font cannot place them.
 *
 * Two children of one `inline-grid` cell, which centres them on each other
 * without absolute positioning or a measured offset.
 */
function AyahMark({
  ayah,
  onOpen,
}: {
  ayah: number;
  onOpen?: () => void;
}) {
  /*
   * Both halves in the muṣḥaf face, at the same size.
   *
   * The face is the whole of it. `font-rf-quran` resolves to KFGQPC, where the
   * circle is the ornate one and the numerals are the small forms drawn to sit
   * inside it — ١ is 0.27em against the circle's 0.89em. Without it the mark
   * inherited the answer's UI face, which renders U+06DD as a plain thin ring
   * and the numerals at full size beside it: a circle and a number, not an āya
   * mark.
   *
   * No offset and no resizing either. Identical font-size and `leading-none` on
   * both children means identical line boxes, so centring them in one grid cell
   * puts them on a **shared baseline** — which is where the font already places
   * the numeral inside the circle. A nudge would be correcting the font.
   */
  const mark = (
    <span className="font-rf-quran inline-grid place-items-center align-middle leading-none">
      <span className="col-start-1 row-start-1" aria-hidden>
        {"\u06DD"}
      </span>
      <span className="col-start-1 row-start-1" aria-hidden>
        {arabicDigits(ayah)}
      </span>
    </span>
  );

  if (!onOpen) return <span className="text-rf-accent mx-0.5">{mark}</span>;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      aria-label={`علوم الآية ${ayah}`}
      className="text-rf-accent rounded-rf-sm mx-0.5 cursor-pointer border-0 bg-transparent p-0 align-middle hover:opacity-70 focus-visible:outline-rf-focus outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2"
    >
      {mark}
    </button>
  );
}

/**
 * Several verses, run together as the muṣḥaf runs them.
 *
 * They were a stack: each āya on its own centred line inside its own ﴿ ﴾, which
 * is how a *quotation* is set, not how a sūra is read. A sūra is continuous —
 * one opening bracket, one closing, and every verse ending in its numbered
 * mark.
 */
function VerseRun({
  chunks,
  onAyah,
  onWord,
}: {
  chunks: FormattedChunk[];
  onAyah?: (surah: number, ayah: number) => void;
  onWord?: (surah: number, ayah: number, word: number, text: string) => void;
}) {
  const bracket = cn(
    "text-rf-accent mx-1 font-normal",
    "font-rf-mushaf text-[1em] [vertical-align:-0.045em]",
  );

  return (
    <span
      dir="rtl"
      lang="ar"
      className={cn(
        "font-rf-quran text-rf-answer-q my-3 block text-center",
        /* one verse settles into a pyramid; a passage of several reads worse
           balanced, since equalising the lines narrows the whole block */
        chunks.length > 1 ? "text-pretty" : "text-balance",
      )}
    >
      <span className={bracket}>﴿</span>
      {chunks.map((chunk, index) => {
        const surah = Number(chunk.metadata?.sura);
        const ayah = Number(chunk.metadata?.aya);
        const located = Number.isInteger(surah) && Number.isInteger(ayah);
        const words = onWord && located ? chunk.text.split(/\s+/).filter(Boolean) : null;

        return (
          <Fragment key={chunk.id}>
            {index > 0 ? " " : null}
            {words ? (
              words.map((word, at) => (
                <Fragment key={`${at}-${word}`}>
                  {at > 0 ? " " : null}
                  <button
                    type="button"
                    onClick={() => onWord?.(surah, ayah, at + 1, word)}
                    aria-label={`علوم الكلمة: ${word}`}
                    className={WORD_BUTTON}
                  >
                    {word}
                  </button>
                </Fragment>
              ))
            ) : (
              <span className="font-rf-quran text-rf-text font-normal">
                {chunk.text}
              </span>
            )}{" "}
            {located ? (
              <AyahMark
                ayah={ayah}
                onOpen={onAyah ? () => onAyah(surah, ayah) : undefined}
              />
            ) : null}
          </Fragment>
        );
      })}
      <span className={bracket}>﴾</span>
    </span>
  );
}

/**
 * The reference row: where this text is, in the terms its own tradition uses.
 *
 * A verse is located by sūra and āya; a hadith by its narrator and where it was
 * recorded. Both come from the chunk's metadata, and a field that is missing is
 * simply absent from the row rather than guessed at — «سورة رقم ١٦» is a worse
 * answer than «سورة النحل» but a far better one than a name recalled from
 * memory, which is what the prompt forbids for scripture.
 */
/**
 * Whether a reference row would render anything.
 *
 * `Section` has to know this *before* it builds the row, because a React
 * element is truthy even when the component inside returns null — which is how
 * «الدرجة» came to be printed as a heading with nothing beneath it. Kept
 * directly beside the row it predicts so the two cannot drift apart.
 */
const hasReference = (chunk: FormattedChunk) => {
  const meta = chunk.metadata ?? {};
  if (kindOf(chunk) === "quran") {
    return Boolean(num(meta.sura) ?? num(meta.aya));
  }
  return Boolean(
    str(meta.narrator) ?? str(meta.attribution) ?? str(meta.reference),
  );
};

const REF_LINK = cn(
  "font-rf-ui text-rf-accent min-h-8 cursor-pointer border-0 bg-transparent p-0",
  "text-[14px] font-medium hover:underline hover:underline-offset-[5px]",
  "focus-visible:outline-rf-focus outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2",
);

/*
 * No «المصدر» link of its own.
 *
 * The row names where the text came from — «متفق عليه»، «سورة البقرة، الآية
 * 255» — and that is reference enough; a second control repeating the word
 * «المصدر» beside it said nothing the row had not already said. The panel it
 * opened is still two gestures away and both are more direct: the quote itself
 * opens it, and so does the numbered citation chip in the answer.
 */
function ReferenceRow({
  chunk,
  verses = 1,
  onSurah,
  onAyah,
}: {
  chunk: FormattedChunk;
  /** How many āyāt the block above this row shows. */
  verses?: number;
  /** مقدمات السورة, from the sūra's name. */
  onSurah?: (surah: number, name: string | null) => void;
  /** علوم الآية, from the āya's number. */
  onAyah?: (surah: number, ayah: number, label: string | null) => void;
}) {
  const meta = chunk.metadata ?? {};
  const kind = kindOf(chunk);

  /*
   * «ما يُنقر: الكلمة · الآية · السورة» — the specification lists what opens a
   * pane, and two of the three are this row. The verse's words are the third,
   * handled in `ScriptureText`.
   */
  if (kind === "quran") {
    const name = str(meta.surahName);
    const surah = Number(num(meta.sura));
    const ayah = Number(num(meta.aya));
    const hasSurah = Number.isInteger(surah) && surah > 0;
    const hasAyah = Number.isInteger(ayah) && ayah > 0;
    const surahLabel = name ? `سورة ${name}` : `سورة رقم ${surah}`;

    if (!hasSurah && !hasAyah) return null;

    return (
      <div className="font-rf-ui text-rf-text-2 -mt-1 mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px]">
        {hasSurah ? (
          onSurah ? (
            <button
              type="button"
              onClick={() => onSurah(surah, name ?? null)}
              className={REF_LINK}
            >
              {surahLabel}
            </button>
          ) : (
            <span dir="auto">{surahLabel}</span>
          )
        ) : null}

        {/*
          * One āya link, or none — never one standing for four.
          *
          * A passage of four verses showed «الآية ١» beside the sūra name, which
          * names the first and silently drops the rest. Listing all four would
          * repeat what the numbered marks already offer, directly above and
          * verse by verse, so the row states the range as text and leaves the
          * links to the marks. A single verse keeps its link: there is no mark
          * standing in for it.
          */}
        {!hasAyah ? null : verses > 1 ? (
          <span dir="auto">
            الآيات {arabicDigits(ayah)}–{arabicDigits(ayah + verses - 1)}
          </span>
        ) : onAyah && hasSurah ? (
          <button
            type="button"
            onClick={() =>
              onAyah(surah, ayah, `علوم الآية ${ayah} من ${surahLabel}`)
            }
            className={REF_LINK}
          >
            الآية {ayah}
          </button>
        ) : (
          <span dir="auto">الآية {ayah}</span>
        )}

      </div>
    );
  }

  const narrator = str(meta.narrator);
  const parts: string[] = [];
  {
    const attribution = str(meta.attribution);
    if (attribution) parts.push(attribution);
    const reference = str(meta.reference);
    if (reference) parts.push(reference);
  }

  if (!narrator && parts.length === 0) return null;

  return (
    <div className="font-rf-ui text-rf-text-2 -mt-1 mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px]">
      {/*
        * الراوي leads the row and carries the weight.
        *
        * It identifies *which* report this is: the same words reach us through
        * more than one Companion, and a grading is on a chain rather than on a
        * sentence. It also had nowhere to come from until now — موسوعة الحديث
        * returns the matn, the grading and the attribution, and the narrator is
        * الدرر السنية's field, so this row has asked for one since it was
        * written and never had one to show.
        */}
      {narrator ? (
        <span className="inline-flex items-center gap-1.5">
          <Icon
            name="user"
            size="sm"
            className="text-rf-text-3 shrink-0"
            aria-hidden
          />
          <span className="text-rf-text-3 text-[13px]">الراوي</span>
          <span dir="auto" className="text-rf-text font-semibold">
            {narrator}
          </span>
        </span>
      ) : null}
      {parts.map((part) => (
        <span key={part} dir="auto">
          {part}
        </span>
      ))}
    </div>
  );
}

/**
 * The grading, in the specification's two colours.
 *
 * «نظام ثنائي واضح ومباشر … لتقليل الحاجز الذهني» — green for the sound and red
 * for the weak, on Dorar's four sections. The colour is a reading aid laid over
 * the grading's own words, never a substitute for them: the words are what the
 * muḥaddith said, and the brief forbids rewording them. An unrecognised
 * grading therefore renders uncoloured and complete rather than being forced
 * onto one of the two sides.
 *
 * The attribution travels with it, because a grade without the body that issued
 * it is half a citation — which is the brief's strictest sentence: «لا ينسب
 * حديث دون مصدر وحكم معتمد في البيانات».
 */
function GradeRow({ chunk }: { chunk: FormattedChunk }) {
  const grade = str(chunk.metadata?.grade);
  if (!grade) return null;

  const tone = gradeTone(grade);
  const attribution = str(chunk.metadata?.attribution);

  return (
    <div className="my-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2.5">
        {/*
          * v1.10 makes the badge quieter: the page's own surface with a hairline
          * border, normal weight, 14/1.7, and a 7px dot. The colour lives in
          * the dot rather than in a filled field — which keeps the grading's
          * *words* the loudest thing in the row, as they should be, since the
          * colour is a reading aid and the words are what the muḥaddith said.
          */}
        <span
          className={cn(
            "border-rf-line bg-rf-surface font-rf-ui inline-flex items-center gap-1.5",
            "rounded-xl border px-3 py-[3px] text-[14px]/[1.7] font-normal",
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
          <span dir="auto">{grade}</span>
        </span>
        {attribution ? (
          <span
            dir="auto"
            className="font-rf-ui text-rf-text-2 text-[14.5px]"
          >
            {attribution}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * «مصدر موثّق» — the mark that says this section carries a source's own words.
 *
 * Beside the heading rather than under the text, which is v1.10's placement and
 * the useful one: the reader is deciding whether to trust a block *before*
 * reading it, so the signal belongs where the eye enters.
 *
 * Carries the provenance in its tooltip where the template names one, so the
 * tag is not a decoration but a claim with a referent.
 */
function TrustTag({ source }: { source?: string }) {
  return (
    <span
      title={source}
      className={cn(
        "border-rf-trust-line text-rf-trust font-rf-ui inline-flex items-center gap-1",
        "rounded-md border px-1.5 py-px align-middle text-[11.5px]/[1.6] font-medium",
      )}
    >
      <Icon name="shield" size="sm" />
      مصدر موثّق
    </span>
  );
}

/** A section heading, with its trust mark where the template declares one. */
const Heading = ({ section }: { section: RenderSection }) =>
  section.trust ? (
    <h3 className="flex flex-wrap items-center gap-2">
      <span>{section.label}</span>
      <TrustTag source={section.trustSource} />
    </h3>
  ) : (
    <h3>{section.label}</h3>
  );

/* ---------- the stack ---------- */

interface SectionStackProps {
  sections: RenderSection[];
  /** Collapsed sections the question asked to have open. */
  open: Set<string>;
  /** Resolves the chunk a structural section named. */
  chunkOf: (id: string) => FormattedChunk | null;
  /** Enlarges a verse or a matn. */
  onQuote?: (kind: "quran" | "hadith", text: string) => void;
  /** Opens تفاصيل الحديث — الراوي وأحكام المحدّثين. */
  onHadith?: (details: HadithDetails) => void;
  /** Opens مقدمات السورة. */
  onSurah?: (surah: number, name: string | null) => void;
  /** Opens علوم الآية. */
  onAyah?: (surah: number, ayah: number, label: string | null) => void;
  /** Opens علوم الكلمة for one word of a verse. */
  onWord?: (
    surah: number,
    ayah: number,
    word: number,
    text: string,
  ) => void;
  /** Renders a prose body through the answer's marking pipeline. */
  prose: (body: string) => ReactNode;
}

export function SectionStack({
  sections,
  open,
  ...handlers
}: SectionStackProps) {
  return (
    <>
      {sections.map((section) => (
        <Section
          key={section.key}
          section={section}
          forceOpen={open.has(section.key)}
          {...handlers}
        />
      ))}
    </>
  );
}

function Section({
  section,
  forceOpen,
  chunkOf,
  onQuote,
  onHadith,
  onSurah,
  onAyah,
  onWord,
  prose,
}: {
  section: RenderSection;
  forceOpen: boolean;
} & Omit<SectionStackProps, "sections" | "open">) {
  /*
   * A `ref` may name several chunks, comma separated.
   *
   * «تفسير سورة الإخلاص» retrieves all four of its verses and used to show one:
   * the section rendered whatever single id the model named. A sūra short
   * enough to read whole should be shown whole, so the ref is a list and the
   * scripture section renders each in turn. Everything else takes the first,
   * which is what a reference row or a grading has always meant by it.
   */
  const chunks = (section.ref ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => chunkOf(id))
    .filter((found): found is FormattedChunk => found !== null);
  const chunk = chunks[0] ?? null;

  /*
   * Parsed once, because the summary needs the count before the body is
   * opened: «الأدلة ٣» tells a reader whether the fold is worth a tap, which is
   * the whole point of a card that counts before it opens.
   */
  const proofs = section.kind === "evidence" ? parseProofs(section.body) : [];

  const content = (() => {
    if (section.kind === "evidence") {
      /* No recognisable proof means the section has nothing to show. The prose
         is not shown instead: an evidence section whose markers did not parse
         is a formatting failure, and `loose` already carries anything the model
         wrote outside the contract — rendering it twice would duplicate it. */
      if (proofs.length === 0) return null;
      return (
        <Evidence
          issue={sectionAttr(section, ["issue", "masala", "q"])}
          proofs={proofs}
          prose={prose}
        />
      );
    }

    /*
     * A structural section falls back to the model's prose when the chunk it
     * named cannot be resolved — a hallucinated id, or a restored conversation
     * whose tool output was pruned. The body usually still holds the quotation,
     * so the reader sees the verse either way; what is lost is only the
     * guarantee that it came from the data rather than from the model.
     */
    if (section.kind !== "prose") {
      /*
       * What a structural section shows when its data is not there: the prose
       * the model wrote, or nothing. Reached by a hallucinated id, a restored
       * conversation whose tool output was pruned, and — the case that actually
       * happened — a `ref` pointing at a retrieved *web page* rather than at a
       * passage from the encyclopedias.
       */
      const fallback = section.body ? prose(section.body) : null;
      if (!chunk) return fallback;

      /*
       * The kind is read, never defaulted.
       *
       * It used to fall back to `"quran"`, so a dorar search result named as
       * the matn was dressed in ﴿ ﴾ — the muṣḥaf brackets — and set at
       * Qurʾānic reading size. A scraped page is not scripture, and presenting
       * one as scripture is the single worst thing this renderer could do.
       */
      /*
       * The Qurʾānic-usage table, which is structural without being scripture:
       * the chunk carries the concordance's own figures in its metadata, and
       * the sentence above the table is the one the retrieval layer composed
       * from those same figures — so neither is retyped.
       */
      if (section.kind === "usage") {
        const usage = usageOf(chunk.metadata);
        return usage ? (
          <QuranUsageTable usage={usage} summary={chunk.text} />
        ) : (
          fallback
        );
      }

      const quoteKind = kindOf(chunk);
      if (!quoteKind) return fallback;

      if (section.kind === "scripture") {
        /*
         * Every Qurʾānic passage runs through `VerseRun`, one verse or several.
         *
         * A passage is read the way the muṣḥaf sets it — continuous, each āya
         * closed by its numbered mark — and that mark is the control that opens
         * علوم الآية. A single verse wants the same: it used to open an
         * enlargement instead, which showed the same words bigger and told the
         * reader nothing, and it had no mark at all, so a verse whose words were
         * each a control of their own had no way to reach its own pane.
         */
        if (kindOf(chunk) === "quran") {
          return (
            <VerseRun
              chunks={chunks}
              onAyah={onAyah ? (s, a) => onAyah(s, a, null) : undefined}
              onWord={onWord}
            />
          );
        }

        const surah = Number(chunk.metadata?.sura);
        const ayah = Number(chunk.metadata?.aya);
        const located =
          kindOf(chunk) === "quran" &&
          Number.isInteger(surah) &&
          Number.isInteger(ayah);
        const details = hadithDetailsOf(chunk);

        return (
          <ScriptureText
            chunk={chunk}
            onOpen={onQuote ? () => onQuote(kindOf(chunk) ?? "quran", chunk.text) : undefined}
            onDetails={details && onHadith ? () => onHadith(details) : undefined}
            onWord={
              located && onWord
                ? (word, text) => onWord(surah, ayah, word, text)
                : undefined
            }
          />
        );
      }
      if (section.kind === "reference") {
        if (!hasReference(chunk)) return fallback;
        return (
          <ReferenceRow
            chunk={chunk}
            verses={chunks.length}
            onSurah={onSurah}
            onAyah={onAyah}
          />
        );
      }

      // a grading the source does not carry is not a grading to head a section
      if (!str(chunk.metadata?.grade)) return fallback;
      return <GradeRow chunk={chunk} />;
    }

    if (!section.body) return null;
    // a proof written beside the point it proves is rendered there
    return /<ev\b/i.test(section.body) ? (
      <ProseWithEvidence
        body={section.body}
        issue={sectionAttr(section, ["issue", "masala", "q"])}
        prose={prose}
      />
    ) : (
      prose(section.body)
    );
  })();

  if (!content) return null;

  // no heading: the section *is* its content — a verse, a reference row, the
  // ruling that opens a fiqh answer
  if (!section.label) return content;

  if (!section.collapsed) {
    return (
      <>
        <Heading section={section} />
        {content}
      </>
    );
  }

  /*
   * `open` rather than `defaultOpen`: the attribute is set from the question,
   * which is fixed for the life of this answer, and the reader can still close
   * it — `<details>` keeps its own state once the user touches it. Making it
   * controlled would take that away.
   */
  return (
    <details open={forceOpen}>
      {/*
       * A row, laid out here rather than in `ANSWER_PROSE`.
       *
       * Tailwind's preflight sets `svg { display: block }`, so the fold chevron
       * — an `Icon`, like every other — took a line of its own beneath the
       * heading («أحكام المحدّثين» with a stray › under it). Nothing else showed
       * it because every other Icon sits in a flex container, where a block
       * child is blockified anyway; `<summary>` was the one plain block
       * container left.
       *
       * On the element, not the container, because the section is rendered in
       * more than one frame — the answer body and the shared-answer view — and a
       * heading that only holds together inside one of them is a heading that
       * will break in the other. It is also what the label, the «مصدر موثّق»
       * tag and the proof count wanted to begin with.
       */}
      <summary className="flex items-center gap-2">
        <span>{section.label}</span>
        {section.trust ? <TrustTag source={section.trustSource} /> : null}
        {proofs.length > 0 ? (
          <span
            className={cn(
              "font-rf-ui text-rf-text-2 bg-rf-surface-2 rounded-full",
              "px-2 py-px text-[12.5px] font-semibold tabular-nums",
            )}
          >
            {proofs.length}
          </span>
        ) : null}
        {/* last in the row, and never squeezed by a long label */}
        <Icon name="chev" size="sm" mirror className="shrink-0" />
      </summary>
      <div>{content}</div>
    </details>
  );
}
