"use client";

import { useState } from "react";

import { cn } from "@agentset/ui/cn";

import { conversationTitle } from "@/lib/rfeeq/chat-title";
import { INTENT_ICON, routeQuestion } from "@/lib/rfeeq/intent";

import type { ChatSummary } from "./use-chat-list";
import { Icon } from "../icon";
import { Button, IconButton } from "../ui/button";
import { State } from "../ui/feedback";
import { Input } from "../ui/field";

interface RailProps {
  grouped: { key: string; label: string; chats: ChatSummary[] }[];
  chats: ChatSummary[];
  noMatches: boolean;
  activeChatId: string | null;
  onOpen: (chatId: string) => void;
  onRename: (chatId: string, title: string) => void;
  onDelete: (chatId: string) => void;
}

/**
 * The reader's saved conversations.
 *
 * Rename and delete happen inside the row rather than in a dialog: the rail is
 * narrow, the row is the thing being named, and a modal over a 272px column to
 * change one word is more ceremony than the action deserves. Delete still
 * confirms, because it cannot be undone.
 */
export function HistoryRail({
  grouped,
  chats,
  noMatches,
  activeChatId,
  onOpen,
  onRename,
  onDelete,
}: RailProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);

  if (chats.length === 0) {
    return (
      <State
        icon="chat"
        title="لا توجد محادثات محفوظة بعد"
        description="ابدأ بسؤالك الأول وستظهر محادثتك هنا."
        className="px-3 py-6"
      />
    );
  }

  if (noMatches) {
    return (
      <State
        icon="search"
        title="لا نتائج مطابقة"
        description="جرّب كلمة أخرى، أو امسح البحث."
        className="px-3 py-6"
      />
    );
  }

  const startRename = (chat: ChatSummary) => {
    setConfirming(null);
    setEditing(chat.id);
    setDraft(chat.title ?? "");
  };

  const commitRename = (chatId: string) => {
    onRename(chatId, draft);
    setEditing(null);
  };

  return (
    /*
     * `grid-cols-1`, which is `minmax(0, 1fr)` and not the same as a bare
     * `grid`.
     *
     * A grid with no declared columns gets one *auto* track, and an auto track
     * is sized to its items' max-content — here the longest chat title in full,
     * around 400px of it. Every row then fills that track rather than the rail,
     * so the title never needs to truncate and the two row actions, which sit
     * at the row's end, are pushed outside the rail entirely. `min-w-0` on the
     * row cannot help: the row's width comes from the track, not from a flex
     * basis. `minmax(0, 1fr)` caps the track at the rail, which is the whole
     * reason Tailwind's `grid-cols-*` are written with that floor.
     */
    <div className="grid grid-cols-1 gap-px">
      {grouped.map((group) => (
        <div key={group.key}>
          <div className="font-rf-ui text-rf-text-3 px-3 pt-3 pb-0.5 text-xs/[1.6] font-semibold">
            {group.label}
          </div>

          {group.chats.map((chat) => {
            if (editing === chat.id) {
              return (
                <div
                  key={chat.id}
                  className="rounded-rf-md flex items-center gap-1 p-1 pe-1"
                >
                  <Input
                    value={draft}
                    autoFocus
                    aria-label="اسم المحادثة"
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") commitRename(chat.id);
                      if (event.key === "Escape") setEditing(null);
                    }}
                    className="h-9 min-h-9 min-w-0 flex-1"
                  />
                  <IconButton
                    className="size-8"
                    aria-label="حفظ الاسم"
                    onClick={() => commitRename(chat.id)}
                  >
                    <Icon name="check" size="sm" />
                  </IconButton>
                  <IconButton
                    className="size-8"
                    aria-label="إلغاء"
                    onClick={() => setEditing(null)}
                  >
                    <Icon name="x" size="sm" />
                  </IconButton>
                </div>
              );
            }

            if (confirming === chat.id) {
              return (
                <div
                  key={chat.id}
                  role="alertdialog"
                  aria-label="تأكيد الحذف"
                  className={cn(
                    "rounded-rf-md border-rf-danger bg-rf-danger-soft grid gap-2 border-[1.5px] p-3",
                    "font-rf-ui text-rf-text text-sm/[1.7] font-medium",
                  )}
                >
                  <span>
                    حذف «{chat.title ?? "محادثة"}»؟ لا يمكن التراجع عن الحذف.
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        setConfirming(null);
                        onDelete(chat.id);
                      }}
                    >
                      <Icon name="trash" size="sm" />
                      حذف
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setConfirming(null)}
                    >
                      إلغاء
                    </Button>
                  </div>
                </div>
              );
            }

            const active = chat.id === activeChatId;

            return (
              <div
                key={chat.id}
                className={cn(
                  "group/row rounded-rf-md flex min-h-10 min-w-0 items-center ps-3",
                  "hover:bg-rf-surface",
                  active && "bg-rf-surface",
                )}
              >
                <button
                  type="button"
                  onClick={() => onOpen(chat.id)}
                  /*
                   * The question as it was asked, on hover — the row shows a
                   * condensed name, and this is the one place the full wording
                   * is still owed.
                   */
                  title={chat.title ?? "محادثة"}
                  {...(active ? { "aria-current": "true" as const } : {})}
                  className={cn(
                    "flex min-h-10 min-w-0 flex-1 cursor-pointer items-center gap-2 border-0 bg-transparent px-3 text-start",
                    "font-rf-ui text-rf-text text-sm font-medium outline-none",
                    active && "text-rf-accent font-semibold",
                  )}
                >
                  {/*
                   * Which corpus answers it, from `routeQuestion` — the same
                   * router the question itself goes through, never a guess
                   * from the title's words. It says at a glance that a row is
                   * a verse rather than a report, which is the first
                   * distinction a list of similarly-worded questions loses,
                   * and it takes the row's own colour when active so the icon
                   * is never a second accent competing with the name.
                   */}
                  <Icon
                    name={INTENT_ICON[routeQuestion(chat.title ?? "").intent]}
                    size="sm"
                    className={cn("shrink-0", !active && "text-rf-text-3")}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {conversationTitle(chat.title)}
                  </span>
                </button>

                {/* revealed on hover, and on focus so the keyboard can reach
                    them at all — opacity alone would hide a focused button */}
                <IconButton
                  className="text-rf-text-3 size-8 opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 focus-visible:opacity-100"
                  aria-label={`إعادة تسمية «${chat.title ?? "محادثة"}»`}
                  onClick={() => startRename(chat)}
                >
                  <Icon name="edit" size="sm" />
                </IconButton>
                <IconButton
                  className="text-rf-text-3 size-8 opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 focus-visible:opacity-100"
                  aria-label={`حذف «${chat.title ?? "محادثة"}»`}
                  onClick={() => setConfirming(chat.id)}
                >
                  <Icon name="trash" size="sm" />
                </IconButton>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
