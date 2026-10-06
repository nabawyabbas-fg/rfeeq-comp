"use client";

import type { MyUIMessage } from "@/types/ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  DEFAULT_CHAT_SETTINGS,
  useChatSettings,
  useNamespaceChatSettings,
} from "@/components/chat/chat-settings.store";
import { LLMSelector } from "@/components/llm-selector";
import { useNamespace } from "@/hooks/use-namespace";
import { useTRPC } from "@/trpc/react";
import { useChat } from "@ai-sdk/react";
import { useQuery } from "@tanstack/react-query";
import { DefaultChatTransport } from "ai";
import { ArrowUpIcon, MessageSquareIcon, PlusIcon } from "lucide-react";

import type { LLM } from "@agentset/validation";
import { Button } from "@agentset/ui/button";
import { Checkbox } from "@agentset/ui/checkbox";
import { cn } from "@agentset/ui/cn";
import { Label } from "@agentset/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@agentset/ui/select";
import { Textarea } from "@agentset/ui/textarea";
import { LLM_MODELS } from "@agentset/validation";

import type { PaneResult } from "./pane";
import { ComparisonHistory } from "./history";
import { ComparePane } from "./pane";
import { usePanePersistence } from "./use-comparison-persistence";

type Mode = "PRIMARY" | "SECONDARY" | "TERTIARY" | "BOTH";

/** Radix Select rejects an empty value, so "unset" needs a sentinel. */
const PLATFORM_DEFAULT = "__default__";

/**
 * A fresh id for one comparison run.
 *
 * `crypto.randomUUID` exists only in a secure context — HTTPS, or localhost.
 * This app is also served over plain HTTP on an IP address, where it is
 * undefined and calling it throws. `crypto.getRandomValues` carries no such
 * restriction, so the v4 layout is assembled by hand from it.
 */
const newComparisonId = (): string => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC 4122 variant
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
};

/**
 * Runs one question against each retrieval mode at once, so the corpora can be
 * judged on the same question rather than on questions asked minutes apart.
 *
 * Each pane is its own conversation with its own transport. They deliberately
 * do not share the global chat store — that store holds a single chat, and
 * several panes reading it would all render the same answer.
 */
const useCompareChat = (
  namespaceId: string,
  mode: Mode,
  // Refs, not values: the transport closure is built on the first render, when
  // the namespace list is still loading. Capturing the id then would send every
  // request without one, and the route would reject the mode. The model is read
  // the same way so changing it applies to the next question without having to
  // rebuild the chats.
  secondaryRef: React.RefObject<string | undefined>,
  tertiaryRef: React.RefObject<string | undefined>,
  modelRef: React.RefObject<LLM | undefined>,
  extractionRef: React.RefObject<LLM | undefined>,
) =>
  useChat<MyUIMessage>({
    id: `compare-${mode}`,
    transport: new DefaultChatTransport({
      api: `/api/chat?namespaceId=${namespaceId}`,
      prepareSendMessagesRequest({ messages, body }) {
        const settings =
          useChatSettings.getState().namespaces[namespaceId] ??
          DEFAULT_CHAT_SETTINGS;
        return {
          body: {
            messages,
            ...body,
            topK: settings.topK,
            rerankLimit: settings.rerankLimit,
            rerankModel: settings.rerankModel,
            llmModel: modelRef.current ?? settings.llmModel,
            ...(extractionRef.current
              ? { extractionModel: extractionRef.current }
              : {}),
            temperature: settings.temperature,
            mode: settings.mode,
            systemPrompt: settings.systemPrompt ?? undefined,
            retrievalMode: mode,
            ...(secondaryRef.current
              ? { secondaryNamespaceId: secondaryRef.current }
              : {}),
            ...(tertiaryRef.current
              ? { tertiaryNamespaceId: tertiaryRef.current }
              : {}),
          },
        };
      },
    }),
    experimental_throttle: 100,
  });

export default function ComparePageClient() {
  const params = useParams();
  const namespace = useNamespace();
  const trpc = useTRPC();
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const { data: namespaces } = useQuery(
    trpc.namespace.getOrgNamespaces.queryOptions({
      slug: params.slug as string,
    }),
  );
  // Oldest first. The query returns newest-first, and taking others[0] as the
  // default second pane meant every newly added corpus silently displaced the
  // one already being compared against. Established corpora keep their pane;
  // a new one lands in the next free slot.
  const others = useMemo(
    () =>
      (namespaces ?? [])
        .filter((n) => n.id !== namespace.id)
        .slice()
        .reverse(),
    [namespaces, namespace.id],
  );

  const [secondaryId, setSecondaryId] = useState<string | null>(null);
  const [tertiaryId, setTertiaryId] = useState<string | null>(null);
  // Opt-in. A third pane costs a third full agentic run per question — its own
  // searches, reranks and generation — so it is only worth paying for when the
  // question is one that corpus might actually answer.
  const [includeTertiary, setIncludeTertiary] = useState(false);

  const secondary = others.find((n) => n.id === secondaryId) ?? others[0];
  // A corpus may hold only one pane; without this a run could show the same
  // namespace twice and read as though two corpora had independently agreed.
  const tertiaryChoices = others.filter((n) => n.id !== secondary?.id);
  const tertiaryChoice =
    tertiaryChoices.find((n) => n.id === tertiaryId) ?? tertiaryChoices[0];
  // Everything downstream keys off `tertiary` being undefined — the pane list,
  // the pooled pane's label, which chats are asked, and whether the request
  // carries a tertiaryNamespaceId — so unchecking restores the three-pane
  // behaviour exactly, with nothing extra sent or charged.
  const tertiary = includeTertiary ? tertiaryChoice : undefined;

  const secondaryRef = useRef<string | undefined>(undefined);
  secondaryRef.current = secondary?.id;
  const tertiaryRef = useRef<string | undefined>(undefined);
  tertiaryRef.current = tertiary?.id;

  // One model across every pane: the corpus is the variable under test, so
  // letting the panes differ on model too would confound the comparison.
  //
  // Held in the persisted settings store rather than in local state. It used to
  // be a useState seeded from the store and never written back, so the choice
  // survived only until the next reload and then silently reverted to the
  // namespace default — you would pick a model, reload, and keep reading
  // answers from a different one with nothing on screen saying so.
  const [chatSettings, setChatSettings] = useNamespaceChatSettings(
    namespace.id,
  );
  const model = chatSettings.llmModel;
  const setModel = (next: LLM) => setChatSettings({ llmModel: next });
  const modelRef = useRef<LLM | undefined>(model);
  modelRef.current = model;

  // undefined means "leave it to the platform default", which is the split the
  // hosted sites run; picking the answering model here makes one model do both
  const [extraction, setExtraction] = useState<LLM | undefined>(undefined);
  const extractionRef = useRef<LLM | undefined>(extraction);
  extractionRef.current = extraction;

  const primaryChat = useCompareChat(
    namespace.id,
    "PRIMARY",
    secondaryRef,
    tertiaryRef,
    modelRef,
    extractionRef,
  );
  const secondaryChat = useCompareChat(
    namespace.id,
    "SECONDARY",
    secondaryRef,
    tertiaryRef,
    modelRef,
    extractionRef,
  );
  const tertiaryChat = useCompareChat(
    namespace.id,
    "TERTIARY",
    secondaryRef,
    tertiaryRef,
    modelRef,
    extractionRef,
  );
  const bothChat = useCompareChat(
    namespace.id,
    "BOTH",
    secondaryRef,
    tertiaryRef,
    modelRef,
    extractionRef,
  );

  // The third pane only exists when the organization has a third corpus to put
  // in it. The hook still runs — hooks cannot be conditional — but the chat is
  // neither asked nor rendered, so an org with two namespaces behaves exactly
  // as it did before.
  const chats = [
    primaryChat,
    secondaryChat,
    ...(tertiary ? [tertiaryChat] : []),
    bothChat,
  ];

  // Taken from the conversation rather than kept in its own state, so a run
  // reloaded from history shows its question as readily as a fresh one.
  const asked = useMemo(() => {
    for (let i = primaryChat.messages.length - 1; i >= 0; i--) {
      const m = primaryChat.messages[i];
      if (m?.role !== "user") continue;
      const text = m.parts
        .filter((part) => part.type === "text")
        .map((part) => (part as { text: string }).text)
        .join("")
        .trim();
      if (text) return text;
    }
    return null;
  }, [primaryChat.messages]);

  // One id per run, shared by every pane. Set when a question is asked, or
  // adopted when a saved run is reloaded so follow-ups extend it rather than
  // starting a fourth record.
  const [comparisonId, setComparisonId] = useState<string | null>(null);
  // chat record per pane when a run is restored, so follow-ups update it
  const [restored, setRestored] = useState<Partial<Record<Mode, string>>>({});

  usePanePersistence({
    namespaceId: namespace.id,
    comparisonId,
    retrievalMode: "PRIMARY",
    messages: primaryChat.messages,
    status: primaryChat.status,
    restoredChatId: restored.PRIMARY,
  });
  usePanePersistence({
    namespaceId: namespace.id,
    comparisonId,
    retrievalMode: "SECONDARY",
    messages: secondaryChat.messages,
    status: secondaryChat.status,
    restoredChatId: restored.SECONDARY,
  });
  usePanePersistence({
    namespaceId: namespace.id,
    comparisonId,
    retrievalMode: "TERTIARY",
    messages: tertiaryChat.messages,
    status: tertiaryChat.status,
    restoredChatId: restored.TERTIARY,
  });
  usePanePersistence({
    namespaceId: namespace.id,
    comparisonId,
    retrievalMode: "BOTH",
    messages: bothChat.messages,
    status: bothChat.status,
    restoredChatId: restored.BOTH,
  });

  const loadComparison = async (id: string) => {
    const res = await fetch(`/api/comparisons/${id}`);
    if (!res.ok) return;
    const { comparison } = (await res.json()) as {
      comparison: {
        panes: {
          chatId: string;
          retrievalMode: Mode | null;
          messages: MyUIMessage[];
        }[];
      };
    };
    const byMode = new Map(comparison.panes.map((p) => [p.retrievalMode, p]));
    primaryChat.setMessages(byMode.get("PRIMARY")?.messages ?? []);
    secondaryChat.setMessages(byMode.get("SECONDARY")?.messages ?? []);
    tertiaryChat.setMessages(byMode.get("TERTIARY")?.messages ?? []);
    bothChat.setMessages(byMode.get("BOTH")?.messages ?? []);
    // A run saved with a third pane brings the checkbox on with it. Restoring
    // it while the box was off would drop that pane on the floor: its answer is
    // loaded and paid for, and nothing on screen would say it existed.
    if (byMode.has("TERTIARY")) setIncludeTertiary(true);
    // adopt the records before the id changes, so the persistence effect sees
    // them on the same render and writes back to them
    setRestored({
      PRIMARY: byMode.get("PRIMARY")?.chatId,
      SECONDARY: byMode.get("SECONDARY")?.chatId,
      TERTIARY: byMode.get("TERTIARY")?.chatId,
      BOTH: byMode.get("BOTH")?.chatId,
    });
    setComparisonId(id);
  };
  /**
   * The run named in the URL, captured during the first render.
   *
   * Read here rather than inside the restore effect below, because the effect
   * that writes the URL runs first on mount — `comparisonId` is still null at
   * that point, so it deleted `?c=` before the restore could ever read it, and
   * a shared link always landed on an empty comparison page. Reading during
   * render happens before any effect, so nothing can clear it first.
   */
  const [initialRunId] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("c"),
  );

  /**
   * Whether the URL may be written yet. A link carries a run id that only
   * exists in the URL until the restore finishes, so writing before then would
   * erase the very id being restored.
   */
  const [urlWritable, setUrlWritable] = useState(!initialRunId);

  /** Open the run named in the URL, once. */
  const openedFromUrl = useRef(false);
  useEffect(() => {
    if (!initialRunId || openedFromUrl.current) return;
    openedFromUrl.current = true;
    void loadComparison(initialRunId).finally(() => setUrlWritable(true));
    // one-shot: the ref guard is what prevents a second run, not the deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRunId]);

  /**
   * Keep `?c=` in step with the open run, so a comparison can be linked,
   * bookmarked and reopened. Runs of one question share a title, so the history
   * dropdown cannot reliably tell them apart; a URL can.
   *
   * Written with history.replaceState rather than the router: this is the same
   * page either way, and a router navigation would remount the panes and throw
   * away the conversations on screen. replaceState rather than pushState so a
   * run does not leave an entry in the back stack for every question asked.
   */
  useEffect(() => {
    if (!urlWritable) return;
    const url = new URL(window.location.href);
    if (comparisonId) url.searchParams.set("c", comparisonId);
    else url.searchParams.delete("c");
    window.history.replaceState(null, "", url);
  }, [comparisonId, urlWritable]);

  const busy = chats.some(
    (c) => c.status === "submitted" || c.status === "streaming",
  );

  const ask = () => {
    const text = input.trim();
    if (!text || busy || !secondary) return;
    setInput("");
    // a fresh question against empty panes starts a new saved run
    if (!comparisonId || primaryChat.messages.length === 0) {
      setRestored({});
      setComparisonId(newComparisonId());
    }
    // fired together so every pane answers the same question at the same time
    for (const chat of chats) {
      void chat.sendMessage({ text });
    }
  };

  const panes: PaneResult[] = [
    {
      label: namespace.name,
      hint: "this knowledge base only",
      messages: primaryChat.messages,
      status: primaryChat.status,
      error: primaryChat.error,
    },
    {
      label: secondary?.name ?? "Second corpus",
      hint: "this corpus only",
      messages: secondaryChat.messages,
      status: secondaryChat.status,
      error: secondaryChat.error,
    },
    ...(tertiary
      ? [
          {
            label: tertiary.name,
            hint: "this corpus only",
            messages: tertiaryChat.messages,
            status: tertiaryChat.status,
            error: tertiaryChat.error,
          },
        ]
      : []),
    {
      label: tertiary ? "All" : "Both",
      hint: tertiary
        ? "all three pooled, then reranked together"
        : "pooled, then reranked together",
      messages: bothChat.messages,
      status: bothChat.status,
      error: bothChat.error,
    },
  ];

  if (others.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-muted-foreground max-w-md text-center text-sm">
          Comparing corpora needs a second knowledge base in this organization.
          There is only one, so there is nothing to compare against.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-calc(var(--spacing)*20))] min-w-0 flex-col gap-3 p-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask();
              }
            }}
            dir="auto"
            rows={2}
            placeholder={`Ask one question; all ${panes.length} answer it at once…`}
            className="resize-none"
          />
        </div>

        <div className="w-52">
          <Label className="text-muted-foreground mb-1.5 block text-xs">
            Answering model
          </Label>
          <LLMSelector value={model} onValueChange={setModel} disabled={busy} />
        </div>

        <div className="w-52">
          <Label className="text-muted-foreground mb-1.5 block text-xs">
            Search model
          </Label>
          <Select
            value={extraction ?? PLATFORM_DEFAULT}
            onValueChange={(v) =>
              setExtraction(v === PLATFORM_DEFAULT ? undefined : (v as LLM))
            }
            disabled={busy}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={PLATFORM_DEFAULT}>Default</SelectItem>
              {Object.entries(LLM_MODELS).flatMap(([provider, models]) =>
                models.map((m) => (
                  <SelectItem
                    key={`${provider}:${m.model}`}
                    value={`${provider}:${m.model}`}
                  >
                    {m.name}
                  </SelectItem>
                )),
              )}
            </SelectContent>
          </Select>
        </div>

        {/*
         * Named from the corpus itself rather than hard-coded, so the control
         * stays truthful if the third corpus is ever a different one. The names
         * read "Erej — Contemporary Fiqh Encyclopedia"; only the part before
         * the dash belongs on a checkbox.
         */}
        {tertiaryChoice && (
          <label className="flex h-9 cursor-pointer items-center gap-2 text-sm whitespace-nowrap">
            <Checkbox
              checked={includeTertiary}
              onCheckedChange={(v) => setIncludeTertiary(v === true)}
              disabled={busy}
            />
            Add {tertiaryChoice.name.split("—")[0]!.trim()} to compare
          </label>
        )}

        {/*
         * Only worth a picker when something is left to choose. With exactly
         * two other corpora each already owns a pane, so a selector there would
         * do nothing but swap their order.
         */}
        {others.length > 2 && (
          <>
            <Select
              value={secondary?.id ?? ""}
              onValueChange={(v) => setSecondaryId(v)}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {others.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* the third corpus is only pickable once it is actually in play */}
            {includeTertiary && (
              <Select
                value={tertiaryChoice?.id ?? ""}
                onValueChange={(v) => setTertiaryId(v)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tertiaryChoices.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </>
        )}

        <div className="flex items-center gap-2">
          <ComparisonHistory
            namespaceId={namespace.id}
            onSelect={(id) => void loadComparison(id)}
            onDeleted={(id) => {
              // only clear the screen when the deleted run is the one on it
              if (id !== comparisonId) return;
              for (const c of chats) c.setMessages([]);
              tertiaryChat.setMessages([]);
              setRestored({});
              setComparisonId(null);
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              for (const c of chats) c.setMessages([]);
              setRestored({});
              setComparisonId(null);
            }}
            disabled={busy || primaryChat.messages.length === 0}
          >
            <PlusIcon className="size-4" />
            New
          </Button>
          <Button
            onClick={ask}
            disabled={!input.trim() || busy}
            isLoading={busy}
          >
            <ArrowUpIcon className="size-4" />
            Compare
          </Button>
        </div>
      </div>

      {asked && (
        <div className="bg-muted/40 flex items-start gap-2 rounded-lg border px-3 py-2">
          <MessageSquareIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
          <p dir="auto" className="min-w-0 flex-1 text-sm font-medium">
            {asked}
          </p>
        </div>
      )}

      <div
        className={cn(
          "grid min-h-0 flex-1 gap-3",
          panes.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3",
        )}
      >
        {panes.map((p) => (
          <ComparePane key={p.label + p.hint} result={p} />
        ))}
      </div>
    </div>
  );
}
