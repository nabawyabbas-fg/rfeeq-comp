"use client";

import type { MyUIMessage } from "@/types/ai";
import type { ReactNode } from "react";
import {
  createContext,
  isValidElement,
  use,
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  useProvidedMessages,
  useStoreMessages,
} from "@/components/chat/conversation-messages";
import { repairCitationTags } from "@/lib/citation-tags";
import { citesNothing, markUncitedParagraphs } from "@/lib/uncited";
import {
  collectSourceText,
  markScriptureQuotes,
  markUnverifiedQuotes,
} from "@/lib/verify-quotes";

import type { RfeeqRouting, RfeeqTemplate } from "@/lib/rfeeq/intent";
import { answerSections } from "@/lib/rfeeq/sections";
import { openSections } from "@/lib/rfeeq/templates";

import { MessageResponse } from "@agentset/ui/ai/message";
import { cn } from "@agentset/ui/cn";

import { Icon } from "../icon";
import { Modal } from "../ui/modal";
import { RfeeqCitation } from "./citation";
import { SectionStack } from "./section";
import { useRfeeqSources } from "./sources";

/**
 * The answer's typography, as settled on the Tafsir preview and then applied
 * to every template.
 *
 * Expressed as descendant selectors because the body is generated markdown —
 * there is no component to hang a class on. The shape of the approved
 * presentation is: headings over body text, no cards, no dividers, nothing
 * boxed. Prose runs at 17/2, which is loose for Latin and correct for Arabic at
 * this measure; revealed text steps up to the reading face at 20/2.1 so the
 * source text is visibly not the generated explanation — the brief requires
 * that distinction (criterion 1, التفريق بين النص الشرعي والشرح المولد) and
 * typography is the honest way to make it.
 */
const ANSWER_PROSE = cn(
  "font-rf-ui text-rf-answer text-rf-text",
  /*
   * Vertical rhythm, specified by the design system on 6 October 2026 rather
   * than chosen here: heading → its text 4px, paragraph → paragraph 12px, list
   * item → item 4px, section → section 24px, collapsed → collapsed 8px.
   *
   * Spelled out because the numbers are small and uneven, and a reader feels
   * their consistency long before they could name it. Rounding them to a scale
   * would be the obvious tidy-up and would undo the thing they are for.
   */
  // paragraphs
  "[&_p]:text-rf-answer [&_p]:text-rf-text [&_p]:my-0",
  "[&_p+p]:mt-3",
  "[&_strong]:font-semibold",
  // section headings: the answer's own structure, not document structure
  "[&_h1]:text-rf-answer-h [&_h1]:text-rf-text [&_h1]:mt-6 [&_h1]:mb-1 [&_h1]:font-semibold",
  "[&_h2]:text-rf-answer-h [&_h2]:text-rf-text [&_h2]:mt-6 [&_h2]:mb-1 [&_h2]:font-semibold",
  "[&_h3]:text-rf-answer-h [&_h3]:text-rf-text [&_h3]:mt-6 [&_h3]:mb-1 [&_h3]:font-semibold",
  "[&_h4]:text-rf-answer-hs [&_h4]:text-rf-text [&_h4]:mt-4 [&_h4]:mb-1 [&_h4]:font-semibold",
  // a heading immediately opening the answer has nothing to be spaced from
  "[&>h1:first-child]:mt-0 [&>h2:first-child]:mt-0 [&>h3:first-child]:mt-0",
  // lists
  "[&_ul]:my-3 [&_ul]:grid [&_ul]:list-disc [&_ul]:gap-1 [&_ul]:ps-5",
  "[&_ol]:my-3 [&_ol]:grid [&_ol]:list-decimal [&_ol]:gap-1 [&_ol]:ps-5",
  "[&_li]:text-rf-answer [&_li]:marker:text-rf-text-3 [&_li]:leading-[2]",
  // a quoted block that is not scripture — an attributed opinion, usually
  "[&_blockquote]:border-rf-accent [&_blockquote]:my-3 [&_blockquote]:border-0 [&_blockquote]:border-s-[3px]",
  "[&_blockquote]:bg-transparent [&_blockquote]:ps-3 [&_blockquote]:not-italic",
  // evidence tables: الدليل / وجه الاستدلال / المصدر
  "[&_table]:w-full [&_table]:border-collapse [&_table]:text-rf-answer",
  "[&_th]:border-rf-line [&_th]:border-0 [&_th]:border-b [&_th]:pe-3 [&_th]:pt-1 [&_th]:pb-1.5",
  "[&_th]:text-rf-text-3 [&_th]:text-start [&_th]:text-[12.5px]/[1.6] [&_th]:font-medium [&_th]:whitespace-nowrap",
  "[&_td]:border-rf-line [&_td]:border-0 [&_td]:border-b [&_td]:py-2 [&_td]:pe-3 [&_td]:align-top",
  "[&_tr:last-child_td]:border-b-0",
  // a wide table scrolls inside itself rather than widening the answer
  "[&>div:has(table)]:overflow-x-auto",
  "[&_a]:text-rf-accent [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-[3px]",
  "[&_hr]:border-rf-line [&_hr]:my-6",
  // collapsible detail — «الأدلة», «الفوائد», the translation
  "[&_details]:mt-2",
  "[&_details+details]:mt-2",
  "[&_summary]:min-h-9 [&_summary]:cursor-pointer [&_summary]:list-none",
  "[&_summary]:text-rf-text [&_summary]:text-rf-answer-h [&_summary]:font-semibold",
  "[&_summary]:marker:content-none [&_summary::-webkit-details-marker]:hidden",
  "[&_summary:hover]:text-rf-accent",
  // code is the one thing that stays LTR
  "[&_code]:font-mono [&_code]:text-[13px] [&_code]:[direction:ltr] [&_code]:[unicode-bidi:isolate]",
  "[&_pre]:rounded-rf-sm [&_pre]:bg-rf-surface-2 [&_pre]:overflow-x-auto [&_pre]:p-3 [&_pre]:[direction:ltr]",
);

/* ---------- the scripture panel ---------- */

type ScriptureKind = "quran" | "hadith";

interface ScriptureApi {
  open: (kind: ScriptureKind, text: string) => void;
}

const ScriptureContext = createContext<ScriptureApi | null>(null);

/**
 * The quote panel, for callers outside this file.
 *
 * The typed `scripture` sections open the same panel an inline quotation does —
 * one way to enlarge a verse, whether the reader reached it from the body or
 * from the section that *is* the verse.
 */
export const useScripturePanel = () => use(ScriptureContext);

/**
 * Opens a quoted verse or matn on its own, at reading size.
 *
 * Kept separate from the sources panel, which answers a different question. A
 * citation asks *which book did this come from*; a verse or a matn is the text
 * itself. The design's full treatment layers sūra, āya, word morphology and
 * muṣḥaf page behind the same tap — those need the Qurʾān platforms on the
 * allow-list, which are not ingested yet, so what is here is the text at the
 * size it deserves and nothing it cannot back up.
 */
export function RfeeqScriptureProvider({ children }: { children: ReactNode }) {
  const [quote, setQuote] = useState<{
    kind: ScriptureKind;
    text: string;
  } | null>(null);

  const open = useCallback(
    (kind: ScriptureKind, text: string) => setQuote({ kind, text }),
    [],
  );
  const api = useMemo(() => ({ open }), [open]);

  return (
    <ScriptureContext value={api}>
      {children}

      <Modal
        open={quote !== null}
        onOpenChange={(next) => {
          if (!next) setQuote(null);
        }}
        title={quote?.kind === "hadith" ? "نص الحديث" : "نص الآية"}
      >
        {quote ? (
          /*
            * The enlargement serves both kinds, so it cannot assume one face.
            * A verse takes the muṣḥaf hand at weight 400 — the only weight it
            * has, and `font-semibold` on it is a synthesised bold that runs the
            * tashkīl into the letters. A matn takes the face it wears
            * everywhere else, balanced only when it is a short centred verse.
            */
          <p
            dir="rtl"
            lang="ar"
            className={cn(
              "text-rf-quran-sm text-rf-text",
              quote.kind === "quran"
                ? "font-rf-quran text-center font-normal text-balance"
                : "font-rf-matn rf-matn",
            )}
          >
            {quote.text}
          </p>
        ) : null}
      </Modal>
    </ScriptureContext>
  );
}

/** Recovers plain text from rendered children — an unverified quote is nested. */
const textOf = (node: ReactNode): string => {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return textOf(node.props.children);
  }
  return "";
};

/**
 * A Qurʾānic or hadith quotation inside the answer.
 *
 * The delimiters are styled apart from the words they enclose — ﴿ ﴾ in the
 * muṣḥaf face and the accent colour, the text in the reading face. That pairing
 * is what makes revealed text recognisable at a glance in a dense answer, which
 * is the point of separating it at all.
 */
function ScriptureQuote({
  kind,
  children,
}: {
  kind?: string;
  children?: ReactNode;
}) {
  const panel = use(ScriptureContext);
  const sources = useRfeeqSources();
  const resolved: ScriptureKind = kind === "hadith" ? "hadith" : "quran";
  const text = textOf(children);

  // the marker wraps the delimiters too, so they can be peeled off and set
  // separately from the words
  const hasDelimiters = /^[﴿«]/.test(text) && /[﴾»]$/.test(text);
  const opening = hasDelimiters ? text.slice(0, 1) : "";
  const closing = hasDelimiters ? text.slice(-1) : "";
  const inner = hasDelimiters ? text.slice(1, -1) : text;

  /*
   * The Qurʾān keeps the muṣḥaf face; a hadith does not.
   *
   * v1.10 separates them: revealed text is set in the Qurʾānic face at 16 on a
   * 50px leading, and a report — even the one the question is about — is set in
   * the answer's own UI face at 16/2. The distinction it draws is between the
   * *recited* word and a narrated one, which the earlier treatment collapsed by
   * giving both the muṣḥaf face.
   */
  const quranic = resolved === "quran";

  /*
   * One wrapper carrying the size, for the same reason the typed sections have
   * one: the brackets are sized in `em`, and `em` resolves against the parent.
   * With the size on the text span alone they measured themselves against the
   * surrounding prose at 16px while the verse ran at 24, so they came out small
   * and sitting wrong.
   */
  const bracket = cn(
    "text-rf-accent mx-1 font-normal",
    quranic
      ? /* measured: the ornate parenthesis is already the letters' height at
           1em and needs only to come down 0.045em — see `section.tsx` */
        "font-rf-mushaf text-[1em] [vertical-align:-0.045em]"
      : "font-rf-matn text-[1.1em] align-baseline",
  );

  const body = (
    <span className={quranic ? "text-rf-answer-q" : "text-rf-matn"}>
      {opening ? <span className={bracket}>{opening}</span> : null}
      <span
        className={cn(
          "font-normal",
          quranic ? "font-rf-quran" : "font-rf-matn rf-matn",
        )}
      >
        {hasDelimiters ? inner : children}
      </span>
      {closing ? <span className={bracket}>{closing}</span> : null}
    </span>
  );

  /*
   * A quotation opens the pane for what it quotes — تفاصيل الحديث for a matn,
   * علوم الآية for a verse — not an enlargement.
   *
   * Resolved per quotation, so an answer quoting four reports gives four, each
   * opening its own, rather than one link at the foot standing in for whichever
   * was retrieved first. The enlargement is what is left when a quotation
   * matches nothing retrieved: the same words, larger, which is all it ever
   * offered.
   */
  const details =
    resolved === "hadith" ? (sources?.hadithQuoted(text) ?? null) : null;
  const verse =
    resolved === "quran" ? (sources?.verseQuoted(text) ?? null) : null;

  if (!panel && !details && !verse) return body;

  return (
    <button
      type="button"
      dir="auto"
      onClick={() => {
        if (details && sources) return sources.openHadith(details);
        if (verse && sources) {
          return sources.openAyah(verse.surah, verse.ayah, null);
        }
        panel?.open(resolved, text);
      }}
      aria-label={
        details
          ? "تفاصيل الحديث"
          : verse
            ? "علوم الآية"
            : resolved === "quran"
              ? "عرض نص الآية"
              : "عرض نص الحديث"
      }
      className={cn(
        "rounded-rf-xs cursor-pointer border-0 bg-transparent p-0 text-start",
        "hover:bg-rf-accent-soft",
        "focus-visible:outline-rf-focus outline-none focus-visible:outline-[3px] focus-visible:outline-offset-1",
      )}
    >
      {body}
    </button>
  );
}

/**
 * A quotation that appears in no retrieved passage.
 *
 * Flagged rather than removed: silently dropping a verse would edit the
 * scholarship on the reader's behalf, and a quote can be correct yet come from
 * a book outside the corpus. What the reader is told is narrower and true —
 * this text could not be checked against the sources behind this answer.
 *
 * Marked in the trust amber, the same colour that marks provenance elsewhere,
 * so "something about the sourcing here" reads as one vocabulary.
 */
function UnverifiedQuote({ children }: { children?: ReactNode }) {
  return (
    <span
      title="لم يُعثر على هذا النص في المقاطع المسترجعة لهذه الإجابة — تحقّق منه قبل الاعتماد عليه."
      className="decoration-rf-trust-line underline decoration-dotted decoration-2 underline-offset-4"
    >
      {children}
      <Icon
        name="alert"
        size="sm"
        className="text-rf-trust mx-0.5 inline align-baseline"
      />
      <span className="sr-only">
        (غير موجود في المصادر المسترجعة — تحقّق منه قبل الاعتماد عليه)
      </span>
    </span>
  );
}

/** A passage that states something without citing anything. Kept quiet. */
function UncitedMarker() {
  return (
    <span
      aria-label="لا مصدر لهذا المقطع"
      title="لا مصدر لهذا المقطع. قد يكون صحيحًا، لكن لا يمكن التحقق منه من النصوص المسترجعة."
      className="text-rf-text-3 hover:text-rf-text mx-0.5 inline-flex cursor-help items-baseline align-baseline"
    >
      <Icon name="info" size="sm" />
    </span>
  );
}

/**
 * Shown above an answer that cites nothing at all.
 *
 * One clear statement rather than a mark on every paragraph. This is the
 * failure the brief's مقاومة الهلوسة criterion ranks worst: an answer that
 * retrieved passages, attributed none of them, and reads as authoritative.
 */
function UncitedBanner() {
  return (
    <div
      role="note"
      className={cn(
        "rounded-rf-md border-rf-trust-line mb-4 flex items-start gap-3 border-s-[3px]",
        "bg-rf-trust-soft font-rf-ui text-rf-text px-4 py-3 text-sm/[1.7] font-medium",
      )}
    >
      <Icon name="alert" className="text-rf-trust mt-0.5 shrink-0" />
      <span>
        هذه الإجابة لا تُسنِد شيئًا إلى مصدر. لا يمكن تتبّع ما فيها إلى النصوص
        التي بُحث فيها — تحقّق قبل الاعتماد عليها.
      </span>
    </div>
  );
}

/* ---------- the body ---------- */

interface AnswerBodyProps {
  children: string;
  message?: MyUIMessage;
  isLoading?: boolean;
  /**
   * The template whose sections this answer was asked to fill.
   *
   * Absent on a shared or restored answer whose question was not
   * re-classified, in which case the body renders as one run of prose — which
   * is also what every answer did before the sections existed.
   */
  template?: RfeeqTemplate | null;
  /** The question, for deciding which folded sections open. */
  question?: string;
  routing?: RfeeqRouting | null;
}

/**
 * The answer's text, marked up and set in the approved presentation.
 *
 * Reuses the existing marking pipeline wholesale — citation repair, scripture
 * marking, quote verification, uncited detection — and changes only how the
 * results are rendered. Those passes encode findings from audited
 * conversations; re-implementing them to restyle them would have been the
 * wrong trade entirely.
 */
export function AnswerBody(props: AnswerBodyProps) {
  // see RfeeqCitation: sibling components rather than a conditional hook
  const provided = useProvidedMessages();
  return provided ? (
    <AnswerBodyWith {...props} messages={provided} />
  ) : (
    <AnswerBodyFromStore {...props} />
  );
}

const AnswerBodyFromStore = (props: AnswerBodyProps) => (
  <AnswerBodyWith {...props} messages={useStoreMessages()} />
);

/**
 * One run of marked prose, through the answer's renderer.
 *
 * Extracted so a section body and a whole answer go through exactly the same
 * pipeline. The allowed tags are not optional decoration: each of
 * `unverified`, `uncited` and `scripture` is injected by a marking pass above,
 * and a tag left undeclared here is dropped by the sanitiser — the flagging
 * then silently does nothing, which is the worst of the three outcomes.
 */
function Prose({
  text,
  isAnimating,
}: {
  text: string;
  isAnimating: boolean;
}) {
  return (
    <MessageResponse
      allowedTags={{
        // <citation ids="…" /> as emitted by the model
        citation: ["ids"],
        unverified: [],
        uncited: [],
        scripture: ["kind"],
      }}
      // both surfaces stream word-by-word server-side, so no client-side
      // token animation is wanted
      animated={false}
      isAnimating={isAnimating}
      components={{
        citation: ({ node: _, ...rest }) => <RfeeqCitation {...rest} />,
        unverified: ({ node: _, ...rest }) => <UnverifiedQuote {...rest} />,
        scripture: ({ node: _, ...rest }) => <ScriptureQuote {...rest} />,
        uncited: () => <UncitedMarker />,
      }}
    >
      {text}
    </MessageResponse>
  );
}

function AnswerBodyWith({
  children,
  isLoading,
  message,
  messages,
  template,
  question,
  routing,
}: AnswerBodyProps & { messages: MyUIMessage[] }) {
  const panel = useRfeeqSources();
  const scripture = useScripturePanel();

  const text = useMemo(() => {
    // Skip while streaming: a quote arriving character by character is
    // incomplete and would be flagged on its way in.
    if (isLoading || message?.role !== "assistant") return children;

    // repaired first — the uncited check reads citation tags, and a malformed
    // one would make a sourced paragraph look unsourced
    const repaired = repairCitationTags(children);
    // scripture first: it wraps every quotation, so marking the unverified ones
    // afterwards nests the two marks instead of splitting a quote in half
    const withQuotes = markUnverifiedQuotes(
      markScriptureQuotes(repaired),
      collectSourceText(messages),
    );
    return markUncitedParagraphs(withQuotes);
  }, [children, isLoading, message?.role, messages]);

  const unattributed =
    !isLoading &&
    message?.role === "assistant" &&
    citesNothing(repairCitationTags(children));

  const animating = Boolean(isLoading) && message?.role === "assistant";

  /*
   * Split *after* marking, so the marks inside each section survive. The two
   * orderings are not interchangeable: the marking passes read whole
   * paragraphs, and splitting first would hand them fragments.
   */
  const sections = useMemo(
    () => (template ? answerSections(text, template) : null),
    [template, text],
  );

  const opened = useMemo(
    () =>
      template
        ? openSections(template, question ?? "", routing)
        : new Set<string>(),
    [question, routing, template],
  );

  const prose = useCallback(
    (body: string) => <Prose text={body} isAnimating={animating} />,
    [animating],
  );

  /*
   * A template that produced no sections falls back to plain prose — the
   * answer is never withheld over its shape. The note only appears once the
   * answer is complete: mid-stream, "no sections yet" is the normal state for
   * the first few hundred milliseconds.
   */
  /*
   * A template whose sections did not build renders as the general shape, with
   * no note saying so.
   *
   * There used to be one — «لم تتوفّر بيانات كافية لعرض الإجابة بقالب …» — on
   * the reasoning that degrading quietly looks the same as never needing the
   * structure. In practice it fired on answers that read perfectly well, and a
   * banner telling a reader their answer is deficient, above an answer that is
   * not, costs more trust than the silent degrade it was guarding against.
   */
  const built = sections?.ordered.length ? sections : null;

  return (
    /*
     * `dir="auto"`, not a hardcoded rtl. The direction resolves from the
     * answer's first strong character, so an Arabic answer renders RTL and an
     * English one LTR.
     *
     * This matters more than the Arabic-first surface suggests: the prompt's
     * own rule is to answer in the language of the question
     * (`docs/prompt-archive/language-lock.md`), the brief's case 12 is
     * explicitly a non-Arabic question, and 18% of the fatwa corpus is English.
     * Pinning this to rtl rendered every one of those backwards.
     */
    <div dir="auto" className={ANSWER_PROSE}>
      {unattributed ? <UncitedBanner /> : null}

      {built ? (
        <>
          {/* anything the model wrote outside the contract, kept rather than
              dropped — a formatting slip must not cost the reader an answer */}
          {sections?.loose ? prose(sections.loose) : null}
          <SectionStack
            sections={built.ordered}
            open={opened}
            chunkOf={(id) => panel?.chunkOf(id) ?? null}
            onQuote={
              scripture ? (kind, body) => scripture.open(kind, body) : undefined
            }
            onHadith={panel ? (details) => panel.openHadith(details) : undefined}
            /* «ما يُنقر: الكلمة · الآية · السورة» — the three panes the
               specification puts behind a tap on the verse itself. */
            onSurah={panel ? (surah, name) => panel.openSurah(surah, name) : undefined}
            onAyah={
              panel
                ? (surah, ayah, label) => panel.openAyah(surah, ayah, label)
                : undefined
            }
            onWord={
              panel
                ? (surah, ayah, word, text) =>
                    panel.openWord(surah, ayah, word, text)
                : undefined
            }
            prose={prose}
          />
        </>
      ) : (
        /* `text`, not `children`: the marks are injected above, and rendering
           the raw string would throw them away */
        prose(text)
      )}
    </div>
  );
}
