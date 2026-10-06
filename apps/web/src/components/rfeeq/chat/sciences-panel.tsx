"use client";

import type {
  AyahSciences,
  SurahSciences,
  WordSciences,
} from "@/lib/rfeeq/sources/mcp/sciences";
import type { PanelView } from "./sources";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { cn } from "@agentset/ui/cn";

import { Icon } from "../icon";
import { usePreferences } from "../preferences";
import { State } from "../ui/feedback";

/**
 * علوم القرآن behind a tap.
 *
 * The specification's rule for this panel is one sentence, and it decides the
 * whole layout: «ما لم يكن السؤال مباشرًا عن أيٍّ مما سبق، تُعرض هذه العلوم في
 * اللوحة الجانبية **مطويّة**». Eight sciences shown at once is a wall; eight
 * folds with their names visible is a table of contents. So every block here is
 * a closed `<details>` the reader opens, and the order is the specification's:
 * أسباب النزول، التفاسير، الإعراب، التصريف، التجويد، القراءات، الإحصاءات.
 *
 * Each block names its own source, as the specification asks — «ويُكتب المصدر
 * أو المصادر بعد كل فقرة». For the commentary that is the edition's own
 * attribution line, which is the citation a tafsīr actually needs: which
 * commentator said it, and when he died.
 */

/* ---------- fetching ---------- */

type Payload =
  | { view: "surah"; data: SurahSciences }
  | { view: "ayah"; data: AyahSciences }
  | { view: "word"; data: WordSciences };

const query = (
  view: Exclude<PanelView, { kind: "sources" } | { kind: "hadith" }>,
  expertise: string,
) => {
  const params = new URLSearchParams({
    view: view.kind,
    surah: String(view.surah),
  });
  if (view.kind !== "surah") params.set("ayah", String(view.ayah));
  if (view.kind === "word") params.set("word", String(view.word));
  // only the āya pane reads commentary, but the key carries it either way so
  // that changing the level refetches rather than showing a stale pane
  params.set("expertise", expertise);
  return params.toString();
};

/**
 * Loads one panel's data.
 *
 * Fetched when the panel opens rather than with the answer: these are eight
 * reads per verse for material most readers never open, and paying for them up
 * front would slow the one thing they are waiting for.
 */
const useSciences = (view: Exclude<PanelView, { kind: "sources" } | { kind: "hadith" }>) => {
  const expertise = usePreferences((state) => state.expertise);
  const key = query(view, expertise);
  /*
   * The result carries the key it answers for, and loading is *derived* from
   * whether that key is the current one.
   *
   * Which is also why there is no `setState` resetting things at the top of the
   * effect: a synchronous setState inside an effect schedules a second render
   * before paint, and the lint rule that forbids it is the same one that sent
   * the sidebar and the guest quota to persisted stores. Deriving the state
   * removes the need rather than working around it — and it fixes the race for
   * free, since a stale response carries a stale key and is simply not the
   * current result.
   */
  const [result, setResult] = useState<{
    key: string;
    payload: Payload | null;
  } | null>(null);

  useEffect(() => {
    let live = true;

    fetch(`/api/rfeeq-sciences?${key}`)
      .then((response) =>
        response.ok ? (response.json() as Promise<Payload>) : null,
      )
      .then((payload) => {
        if (live) setResult({ key, payload });
      })
      .catch(() => {
        if (live) setResult({ key, payload: null });
      });

    // a reader who taps three words in quick succession must not be shown the
    // first one's answer under the third one's heading
    return () => {
      live = false;
    };
  }, [key]);

  const settled = result?.key === key ? result : null;
  return {
    loading: settled === null,
    payload: settled?.payload ?? null,
    failed: settled !== null && settled.payload === null,
  };
};

/* ---------- blocks ---------- */

/**
 * One science, as a collapsible card.
 *
 * v1.10 restyles these from rule-separated disclosures into bordered cards —
 * «each science is a collapsible card styled like a source card» — which is
 * what makes a pane of eight folded sciences read as a list of things rather
 * than as one long ruled column. The 56px summary is the design's; so is the
 * chevron that rotates rather than flips.
 *
 * `open` is for the one case the specification carves out: a question asked
 * directly about this science. A block with nothing in it does not render at
 * all, since an empty fold is a promise of content.
 */
function Block({
  label,
  source,
  open = false,
  children,
}: {
  label: string;
  /** Named after the content, per «ويُكتب المصدر أو المصادر بعد كل فقرة». */
  source?: string | null;
  open?: boolean;
  children: ReactNode;
}) {
  if (!children) return null;

  return (
    <details
      open={open}
      className={cn(
        "border-rf-line rounded-rf-md bg-rf-surface group border-[1.5px]",
        "hover:border-rf-line-strong",
      )}
    >
      <summary
        className={cn(
          "font-rf-ui text-rf-text flex min-h-14 cursor-pointer list-none items-center",
          "justify-between gap-3 px-4 py-3 text-[15px]/[1.6] font-semibold",
          "marker:content-none [&::-webkit-details-marker]:hidden",
          "focus-visible:outline-rf-focus rounded-rf-md outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2",
        )}
      >
        <span className="min-w-0">{label}</span>
        <Icon
          name="chev"
          size="sm"
          className="text-rf-text-3 shrink-0 transition-transform group-open:-rotate-90"
        />
      </summary>
      <div
        dir="auto"
        className="font-rf-ui text-rf-text grid grid-cols-1 gap-1 px-4 pb-4 text-[15px]/[1.9] whitespace-pre-line"
      >
        {children}
        {source ? (
          <span className="font-rf-ui text-rf-trust mt-1.5 block text-[12.5px]/[1.6]">
            المصدر: {source}
          </span>
        ) : null}
      </div>
    </details>
  );
}

/**
 * A science as a two-column table — v1.10's «i'rab, tasreef, tajweed and word
 * stats as tables».
 *
 * Where the data is already key and value, a table says so; prose that happens
 * to contain a colon does not. So the word's sciences and the root's figures
 * are tabulated, and the āya's own tajwīd and iʿrāb — which the centre returns
 * as running prose about the whole verse — stay prose rather than being cut
 * into rows that the source never drew.
 */
function Rows({ rows }: { rows: [string, string][] }) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[14px]/[1.8]">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-rf-line border-0 border-b last:border-b-0">
              <td className="w-[34%] min-w-[72px] py-2 pe-3 align-top font-semibold">
                {label}
              </td>
              <td dir="auto" className="py-2 align-top whitespace-pre-line">
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The figures block — «الإحصاءات (أرقام)», with the **number above its label**.
 *
 * v1.10 inverts the pair (`.pstats div b{order:-1}`). A grid of figures is
 * scanned for the numbers, and putting them on the top line is what lets the
 * eye run down the column instead of zig-zagging between label and value.
 */
function Figures({ rows }: { rows: [string, string][] }) {
  if (rows.length === 0) return null;
  return (
    /*
     * The label first, then the figure, both aligned to the same edge.
     *
     * They were the other way round and carried `dir="auto"` on the value,
     * which resolves per value: a bare number is neutral, so it came out
     * left-aligned, while «الطوال» came out right-aligned. Half the grid sat
     * against one edge and half against the other, and nothing lined up with
     * its own label. `unicode-bidi: isolate` keeps a number from interacting
     * with the Arabic around it without letting it set the alignment.
     */
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
      {rows.map(([label, value]) => (
        <div key={label} className="flex min-w-0 flex-col gap-0.5">
          <dt className="font-rf-ui text-rf-text-3 truncate text-[12.5px]">
            {label}
          </dt>
          <dd className="font-rf-ui text-rf-text text-[15px] font-semibold tabular-nums [unicode-bidi:isolate]">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const CENTRE = "مركز تفسير للدراسات القرآنية";

/* ---------- the three views ---------- */

function SurahView({ data }: { data: SurahSciences }) {
  const stats = data.stats;
  const figures: [string, string][] = [];
  if (data.ayahCount) figures.push(["عدد الآيات", String(data.ayahCount)]);
  if (stats?.revelationOrder) {
    figures.push(["ترتيب النزول", String(stats.revelationOrder)]);
  }
  figures.push(["الترتيب في المصحف", String(data.surah)]);
  if (stats?.surahClass) figures.push(["صنف السورة", stats.surahClass]);
  if (stats?.wordCount) figures.push(["عدد الكلمات", String(stats.wordCount)]);
  if (stats?.charCount) figures.push(["عدد الحروف", String(stats.charCount)]);
  if (stats?.mostFrequentWord) {
    figures.push(["أكثر كلمة تكرارًا", stats.mostFrequentWord]);
  }
  if (stats?.longestWord) figures.push(["أطول كلمة", stats.longestWord]);
  if (stats?.sujud) figures.push(["سجود", stats.sujud]);

  return (
    <div className="grid grid-cols-1 gap-2">
      <Block label="أسماء السورة" source={CENTRE} open>
        {/*
          * Every name, under the heading the centre files it under. It used to
          * print `data.names`, which `fetch_surah_info` returns holding exactly
          * one entry — so «أسماء السورة» showed a single name for every sūra in
          * the Qurʾān. البقرة alone has six.
          */}
        {data.nameGroups.length > 0 ? (
          <span className="grid grid-cols-1 gap-1.5">
            {data.nameGroups.map((group) => (
              <span key={group.kind} className="block">
                <span className="text-rf-text-3 text-[12.5px]">
                  أسماؤها ال{group.kind}:{" "}
                </span>
                <span dir="auto">{group.names.join(" · ")}</span>
              </span>
            ))}
          </span>
        ) : data.names.length > 0 ? (
          data.names.join(" · ")
        ) : null}
      </Block>
      <Block label="المكي والمدني" source={CENTRE} open>
        {data.revelationType}
      </Block>
      <Block label="فضائل السورة وخصائصها" source={CENTRE}>
        {data.virtues}
      </Block>
      <Block label="الإحصاءات" source={CENTRE} open>
        {figures.length > 0 ? <Figures rows={figures} /> : null}
      </Block>
    </div>
  );
}

function AyahView({ data }: { data: AyahSciences }) {
  return (
    <div className="grid grid-cols-1 gap-2">
      {/* The specification's order for this pane, verbatim. */}
      <Block label="أسباب النزول" source={CENTRE}>
        {data.nuzool ? (
          <>
            {data.nuzool.text}
            {!data.nuzool.established ? (
              <p className="text-rf-text-2 mt-2 text-[14px]">
                عدم ثبوت سبب النزول نتيجةٌ علمية، لا نقصٌ في البحث.
              </p>
            ) : null}
          </>
        ) : null}
      </Block>

      <Block label="الترجمة" source="موسوعة القرآن الكريم">
        {data.translation ? (
          <>
            <span dir="ltr" lang="en" className="block text-start">
              {data.translation.text}
            </span>
            {data.translation.edition ? (
              <span className="font-rf-ui text-rf-text-3 mt-1 block text-[12.5px]">
                {data.translation.edition}
              </span>
            ) : null}
          </>
        ) : null}
      </Block>

      <Block label="التفاسير">
        {data.tafsirs.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {data.tafsirs.map((entry) => (
              <section key={entry.edition ?? entry.attribution}>
                <h4 className="font-rf-ui text-rf-text mb-1 text-[14.5px] font-semibold">
                  {entry.attribution ?? entry.edition}
                </h4>
                <p className="whitespace-pre-line">{entry.text}</p>
              </section>
            ))}
          </div>
        ) : null}
      </Block>

      <Block label="إعراب الآية" source={CENTRE}>
        {data.irab}
      </Block>
      <Block label="غريب القرآن" source={CENTRE}>
        {data.gharib}
      </Block>
      <Block label="التجويد" source={CENTRE}>
        {data.tajweed}
      </Block>

      <Block label="القراءات" source={CENTRE}>
        {data.qeraat.length > 0 ? (
          <div className="grid grid-cols-1 gap-3">
            {data.qeraat.map((entry, index) => (
              <section key={entry.wordNo ?? `entry-${index}`}>
                {/*
                  * The word itself, in the muṣḥaf face, with its number beside
                  * it. «الكلمة ٤» alone told a reader which token to count to
                  * and nothing more, while the readings beneath it describe a
                  * word they could not see — «قرأ بالهمزة، مع سكون الفاء» is
                  * about «كُفُوًا». The number stays, because it is how the
                  * centre addresses the word and how علوم الكلمة is reached.
                  */}
                {entry.wordNo ? (
                  <h4 className="mb-1 flex flex-wrap items-baseline gap-x-2">
                    {entry.word ? (
                      <span
                        dir="rtl"
                        lang="ar"
                        className="font-rf-quran text-rf-text text-[19px]"
                      >
                        {entry.word}
                      </span>
                    ) : null}
                    <span className="font-rf-ui text-rf-text-3 text-[12.5px]">
                      الكلمة {entry.wordNo}
                    </span>
                  </h4>
                ) : null}
                <ul className="grid grid-cols-1 gap-1">
                  {entry.variants.map((variant) => (
                    <li key={variant.reader}>
                      <span className="font-semibold">{variant.reader}: </span>
                      {variant.reading}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : null}
      </Block>
    </div>
  );
}

function WordView({ data }: { data: WordSciences }) {
  /*
   * One table rather than four folds. The word's sciences are short and
   * parallel — a meaning, a parse, a derivation, a note on the rasm — and
   * reading them side by side is the point of asking about a word at all.
   */
  const sciences: [string, string][] = [];
  if (data.meaning) sciences.push(["المعنى", data.meaning]);
  if (data.irab) sciences.push(["الإعراب", data.irab]);
  if (data.sarf) sciences.push(["التصريف", data.sarf]);
  if (data.rasm) sciences.push(["الرسم", data.rasm]);

  const stats = data.rootStats;
  const figures: [string, string][] = [];
  if (data.root) figures.push(["الجذر", data.root]);
  if (stats?.occurrences) figures.push(["مواضع الجذر", String(stats.occurrences)]);
  if (stats?.surahs) figures.push(["في سور", String(stats.surahs)]);
  if (stats?.ayahs) figures.push(["في آيات", String(stats.ayahs)]);
  if (stats?.forms) figures.push(["صيغ مختلفة", String(stats.forms)]);

  return (
    <div className="grid grid-cols-1 gap-2">
      <Block label="علوم الكلمة" source={CENTRE} open>
        {sciences.length > 0 ? <Rows rows={sciences} /> : null}
      </Block>
      <Block label="إحصاءات الجذر" source={CENTRE}>
        {figures.length > 0 ? <Figures rows={figures} /> : null}
      </Block>
    </div>
  );
}

/**
 * The āya / word switch.
 *
 * v1.10 puts a segmented control at the head of these panes, with the selected
 * tab in white. It earns its place by what it fixes: a reader who taps a word
 * has left the āya behind, and without this the only way back is to close the
 * pane and tap the verse again.
 */
function ViewTabs({
  view,
  onAyah,
}: {
  view: Exclude<PanelView, { kind: "sources" } | { kind: "hadith" }>;
  onAyah: () => void;
}) {
  if (view.kind === "surah") return null;
  const onWord = view.kind === "word";

  return (
    <div
      role="group"
      aria-label="علوم الآية والكلمة"
      className="bg-rf-surface-2 rounded-rf-sm mb-1 grid grid-cols-2 gap-1 p-[3px]"
    >
      <button
        type="button"
        aria-pressed={!onWord}
        onClick={onAyah}
        className={cn(
          "font-rf-ui rounded-rf-xs min-h-9 cursor-pointer border-0 text-[14px] font-medium",
          "focus-visible:outline-rf-focus outline-none focus-visible:outline-[3px] focus-visible:outline-offset-1",
          onWord
            ? "text-rf-text-2 hover:text-rf-text bg-transparent"
            : "bg-rf-surface text-rf-text shadow-rf-1",
        )}
      >
        الآية
      </button>
      <button
        type="button"
        aria-pressed={onWord}
        disabled={!onWord}
        className={cn(
          "font-rf-ui rounded-rf-xs min-h-9 border-0 text-[14px] font-medium",
          onWord
            ? "bg-rf-surface text-rf-text shadow-rf-1"
            : "text-rf-text-3 bg-transparent",
        )}
      >
        {onWord && view.text ? `الكلمة: ${view.text}` : "الكلمة"}
      </button>
    </div>
  );
}

/* ---------- the panel ---------- */

export function SciencesPanel({
  view,
  onAyah,
}: {
  view: Exclude<PanelView, { kind: "sources" } | { kind: "hadith" }>;
  /** Returns a word pane to the āya it belongs to. */
  onAyah: (surah: number, ayah: number) => void;
}) {
  const { loading, payload, failed } = useSciences(view);
  const tabs =
    view.kind === "word" || view.kind === "ayah" ? (
      <ViewTabs
        view={view}
        onAyah={() => onAyah(view.surah, view.ayah)}
      />
    ) : null;

  if (loading) {
    return (
      <>
        {tabs}
        <State
        icon="search"
        title="يجري تحضير العلوم"
          description="تُقرأ من مركز تفسير للدراسات القرآنية."
        />
      </>
    );
  }

  if (failed || !payload) {
    /*
     * Named as unreachable rather than shown as empty. The difference matters
     * here more than most places: «لم يثبت سبب نزول لهذه الآية» and «لم نتمكن
     * من السؤال» are different claims, and only one of them is about the Qurʾān.
     */
    return (
      <>
        {tabs}
        <State
          icon="wifioff"
          title="تعذّر الوصول إلى المصدر"
          description="لم نتمكّن من قراءة هذه العلوم الآن. أعد المحاولة بعد قليل."
        />
      </>
    );
  }

  const body =
    payload.view === "surah" ? (
      <SurahView data={payload.data} />
    ) : payload.view === "ayah" ? (
      <AyahView data={payload.data} />
    ) : (
      <WordView data={payload.data} />
    );

  return (
    <div className="grid grid-cols-1 gap-3">
      {tabs}
      {payload.view === "word" && payload.data.word ? (
        /*
         * The word as مركز تفسير spells it, shown rather than assumed.
         *
         * The verse on screen is the ʿUthmānī text from موسوعة القرآن while the
         * index was resolved against the centre's own tokens. The two follow the
         * same muṣḥaf word division, but naming the word that was analysed means
         * a divergence would be visible to the reader instead of quietly handing
         * them another word's grammar.
         */
          /*
           * Weight 400: the muṣḥaf face has no other, and `font-semibold` on it
           * is a browser-synthesised bold that runs the tashkīl into the
           * letters beneath.
           */
        <p
          dir="rtl"
          lang="ar"
          className="font-rf-quran text-rf-quran-sm text-rf-text text-center font-normal"
        >
          {payload.data.word}
        </p>
      ) : null}
      {body}
    </div>
  );
}
