"use client";

import { cn } from "@agentset/ui/cn";

import type { ChatSummary } from "./use-chat-list";
import { Icon } from "../icon";
import { RfeeqLogo } from "../logo";
import { IconButton } from "../ui/button";
import { Input } from "../ui/field";
import { HistoryRail } from "./history-rail";

/**
 * Sidebar navigation, data-driven.
 *
 * One entry today. Kept as a list because the design's note is explicit that a
 * second destination should be one more row here and nothing else — settings
 * went to the account menu in v1.3 precisely to keep this true.
 */
const NAV = [{ key: "chat", label: "المحادثة", icon: "chat" as const }];

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
  isGuest: boolean;
  /** The guest's live conversation, when they have one going. */
  guestSessionTitle: string | null;
  searchOpen: boolean;
  onToggleSearch: () => void;
  query: string;
  onQueryChange: (value: string) => void;
  grouped: { key: string; label: string; chats: ChatSummary[] }[];
  chats: ChatSummary[];
  noMatches: boolean;
  activeChatId: string | null;
  onNewChat: () => void;
  onOpenChat: (chatId: string) => void;
  onRenameChat: (chatId: string, title: string) => void;
  onDeleteChat: (chatId: string) => void;
  /** Opens the sign-in wall; a guest has no saved history to show. */
  onRequestSignIn: () => void;
}

export function Sidebar({
  open,
  onToggle,
  isGuest,
  guestSessionTitle,
  searchOpen,
  onToggleSearch,
  query,
  onQueryChange,
  grouped,
  chats,
  noMatches,
  activeChatId,
  onNewChat,
  onOpenChat,
  onRenameChat,
  onDeleteChat,
  onRequestSignIn,
}: SidebarProps) {
  return (
    <aside
      aria-label="الشريط الجانبي"
      className={cn(
        "flex min-h-0 shrink-0 flex-col gap-2 pb-3",
        // collapsed is an icon rail, not a hidden sidebar: the new-chat button
        // and the nav stay reachable at 64px
        open ? "w-68 px-3" : "w-16 px-2",
        // below the design's breakpoint the rail is replaced by the top bar's
        // menu button, which opens the same history in a drawer
        "max-rf:hidden",
      )}
    >
      <div
        className={cn(
          "flex min-h-13 items-center",
          open ? "justify-between px-3" : "justify-center",
        )}
      >
        {open ? <RfeeqLogo className="w-[65px]" /> : null}
        <IconButton
          onClick={onToggle}
          aria-expanded={open}
          aria-label={open ? "إخفاء الشريط الجانبي" : "إظهار الشريط الجانبي"}
        >
          <Icon name="sidebar" size="lg" mirror />
        </IconButton>
      </div>

      <NavButton
        open={open}
        icon="plus"
        label="محادثة جديدة"
        onClick={onNewChat}
      />

      <nav aria-label="التنقّل الرئيسي" className="grid gap-0.5">
        {NAV.map((item) => (
          <NavButton
            key={item.key}
            open={open}
            icon={item.icon}
            label={item.label}
            current
          />
        ))}
      </nav>

      {open ? (
        <section
          aria-labelledby="rf-history-heading"
          className="mt-4 flex min-h-0 flex-1 flex-col"
        >
          <div className="flex min-h-8 items-center justify-between ps-3">
            <h2
              id="rf-history-heading"
              className="font-rf-ui text-rf-text-3 text-xs/[1.6] font-semibold"
            >
              سجل المحادثات
            </h2>
            <IconButton
              className="text-rf-text-3 hover:bg-rf-surface hover:text-rf-text size-8"
              aria-label="بحث في المحادثات"
              aria-expanded={searchOpen}
              onClick={isGuest ? onRequestSignIn : onToggleSearch}
            >
              <Icon name="search" size="sm" />
            </IconButton>
          </div>

          {searchOpen && !isGuest ? (
            <div className="my-1 px-1">
              <Input
                value={query}
                autoFocus
                aria-label="بحث في المحادثات"
                placeholder="ابحث في المحادثات"
                onChange={(event) => onQueryChange(event.target.value)}
              />
            </div>
          ) : null}

          {/*
            * `overflow-x-hidden`, and not as a workaround.
            *
            * A history rail has nothing a reader should reach by scrolling it
            * sideways: every row is one truncated line, and panning the column
            * to read the end of a title moves all the others with it. Without
            * this, any one child wider than the rail turns the whole list into
            * a horizontal scroller — and `overflow-y: auto` alone computes
            * `overflow-x` to `auto` too, so one stray row is enough to produce
            * one.
            */}
          <div
            className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
            aria-live="polite"
          >
            {isGuest ? (
              <GuestHistory
                sessionTitle={guestSessionTitle}
                onRequestSignIn={onRequestSignIn}
              />
            ) : (
              <HistoryRail
                grouped={grouped}
                chats={chats}
                noMatches={noMatches}
                activeChatId={activeChatId}
                onOpen={onOpenChat}
                onRename={onRenameChat}
                onDelete={onDeleteChat}
              />
            )}
          </div>
        </section>
      ) : null}
    </aside>
  );
}

function NavButton({
  open,
  icon,
  label,
  current,
  onClick,
}: {
  open: boolean;
  icon: "plus" | "chat";
  label: string;
  current?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      {...(current ? { "aria-current": "page" as const } : {})}
      className={cn(
        "rounded-rf-sm flex min-h-10 w-full cursor-pointer items-center gap-3 border-0 bg-transparent",
        "font-rf-ui text-rf-text text-start text-sm font-semibold",
        "hover:bg-rf-surface",
        "aria-[current=page]:bg-rf-surface aria-[current=page]:text-rf-accent",
        "focus-visible:outline-rf-focus outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2",
        "[&_svg]:text-rf-text-2 aria-[current=page]:[&_svg]:text-rf-accent",
        open ? "px-3" : "justify-center px-0",
      )}
    >
      <Icon name={icon} />
      {open ? <span className="whitespace-nowrap">{label}</span> : null}
    </button>
  );
}

/**
 * What a guest sees in place of history.
 *
 * Their current conversation, which is real and on screen, plus one dashed row
 * explaining what an account would add. Deliberately not a fetched list: a
 * guest's chats are keyed to a browser cookie, and presenting those as "your
 * saved conversations" would promise a persistence that does not survive a
 * different device.
 */
function GuestHistory({
  sessionTitle,
  onRequestSignIn,
}: {
  sessionTitle: string | null;
  onRequestSignIn: () => void;
}) {
  return (
    <div className="grid gap-px">
      {sessionTitle ? (
        <>
          <div className="font-rf-ui text-rf-text-3 px-3 pt-1 pb-0.5 text-xs/[1.6] font-semibold">
            هذه الجلسة
          </div>
          <div className="rounded-rf-md bg-rf-surface flex min-h-10 items-center ps-3">
            <span
              aria-current="true"
              className="font-rf-ui text-rf-accent min-w-0 flex-1 truncate px-3 text-sm font-semibold"
            >
              {sessionTitle}
            </span>
          </div>
        </>
      ) : null}

      <button
        type="button"
        onClick={onRequestSignIn}
        className={cn(
          "mt-3 grid w-full cursor-pointer grid-cols-[auto_1fr] items-center gap-x-2 px-3 py-2",
          "rounded-rf-md border-rf-line-strong border border-dashed bg-transparent text-start",
          "font-rf-ui text-rf-text text-sm/[1.6] font-medium",
          "hover:border-rf-accent hover:bg-rf-surface",
          "focus-visible:outline-rf-focus outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2",
        )}
      >
        <Icon name="clock" size="sm" className="text-rf-text-2" />
        <span>محادثاتك المحفوظة</span>
        <small className="font-rf-ui text-rf-text-3 col-start-2 text-xs/[1.5] font-normal">
          سجّل الدخول لحفظ محادثاتك والعودة إليها
        </small>
      </button>
    </div>
  );
}
