"use client";

import type { MyUIMessage } from "@/types/ai";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useActiveChat } from "@/components/chat/active-chat.store";
import { useCorpus, useIsGuest, useViewer } from "@/contexts/rfeeq-context";
import { useChatProperty } from "ai-sdk-zustand";
import { toast } from "sonner";

import { cn } from "@agentset/ui/cn";

import type { GuestWallReason } from "../auth/guest-wall";
import { GuestWall, SignInPrompt } from "../auth/guest-wall";
import { Icon } from "../icon";
import { applyFontSize, usePreferences } from "../preferences";
import { Button } from "../ui/button";
import { Input } from "../ui/field";
import { Drawer } from "../ui/modal";
import { HistoryRail } from "./history-rail";
import { useChatUrl } from "./use-chat-url";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { useChatList } from "./use-chat-list";

/**
 * Pulls the current conversation's first question out for the guest rail.
 *
 * A guest has no saved history, so the only row the rail can show is the live
 * conversation — named the way a saved one would be, by its opening question.
 */
const firstQuestion = (messages: MyUIMessage[]) => {
  const first = messages.find((message) => message.role === "user");
  if (!first) return null;

  for (const part of first.parts) {
    if (part.type === "text" && part.text.trim()) {
      return part.text.trim().slice(0, 120);
    }
  }
  return null;
};

/**
 * The app frame: history rail, top bar, and the conversation between them.
 *
 * Composed by each page rather than by the route layout, for two reasons. The
 * sign-in screen has no shell at all, and the chat page has to call its chat
 * hook *above* this component — the rail's "new chat" and "open chat" write to
 * the same store the hook owns, and a parent rendering before its child would
 * otherwise read the store before it was synced.
 */
export function RfeeqShell({ children }: { children: React.ReactNode }) {
  const viewer = useViewer();
  const isGuest = useIsGuest();
  const corpus = useCorpus();

  const open = usePreferences((state) => state.sidebarOpen);
  const toggle = usePreferences((state) => state.toggleSidebar);

  /*
   * The text-size preference is applied here because the shell is the one
   * component every screen passes through, and it has to reach the root
   * element — dialogs and the source panel portal out of the app tree and
   * would otherwise keep the default scale.
   */
  const fontSize = usePreferences((state) => state.fontSize);
  useEffect(() => applyFontSize(fontSize), [fontSize]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [wall, setWall] = useState<GuestWallReason | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  /*
   * The rail is rendered on settings and «عن رفيق» too, where there is no
   * conversation on screen. Starting or opening one there has to return to the
   * chat, or the click appears to do nothing.
   */
  /*
   * `/c/<id>` is the chat surface too, not somewhere to be returned from.
   *
   * This pushed `/` whenever the path was not exactly `/`, which was right
   * while a conversation lived in a query parameter and wrong the moment it
   * moved into the path: opening a conversation from the rail would navigate to
   * `/` — re-rendering the route and emptying the chat — a beat before the URL
   * was rewritten to `/c/<new>`.
   */
  const onChatSurface = pathname === "/" || pathname.startsWith("/c/");
  const goToChat = useCallback(() => {
    if (!onChatSurface) router.push("/");
  }, [onChatSurface, router]);

  const setMessages = useChatProperty((state) => state.setMessages);
  const messages = useChatProperty((state) => state.messages) as MyUIMessage[];
  const activeChatId = useActiveChat((state) => state.chatId);
  const setChatId = useActiveChat((state) => state.setChatId);

  const list = useChatList({
    // null here means the no-corpus conversations, which is what this
    // surface saves — the same set, queried the same way
    namespaceId: corpus?.id ?? null,
    activeChatId,
    enabled: !isGuest,
  });

  const newChat = useCallback(() => {
    setMessages([]);
    // Detaching from the saved chat is what makes this a *new* conversation:
    // a save replaces the record wholesale, so without this the next turn
    // would overwrite the conversation just left.
    setChatId(null);
    setDrawerOpen(false);
    goToChat();
  }, [setMessages, setChatId, goToChat]);

  const openChat = useCallback(
    async (chatId: string) => {
      try {
        const res = await fetch(`/api/chats/${chatId}`);
        if (!res.ok) throw new Error("not found");

        const { chat } = (await res.json()) as {
          chat: { messages: unknown[] };
        };

        setMessages(chat.messages as MyUIMessage[]);
        setChatId(chatId);
        setDrawerOpen(false);
        goToChat();
      } catch {
        toast.error("تعذّر فتح هذه المحادثة");
      }
    },
    [setMessages, setChatId, goToChat],
  );

  /*
   * `?c=<id>` in the address bar, so a conversation can be bookmarked, opened
   * in another tab and reached with the browser's Back button. Mounted after
   * `openChat` and `newChat` because it drives both.
   */
  const openChatFromUrl = useCallback(
    (id: string) => void openChat(id),
    [openChat],
  );
  useChatUrl({
    activeChatId,
    openChat: openChatFromUrl,
    startNew: newChat,
    enabled: !isGuest,
  });

  const requestSignIn = useCallback(
    (reason: GuestWallReason = "history") => setWall(reason),
    [],
  );

  return (
    <div className="bg-rf-bg font-rf-ui text-rf-text flex h-dvh flex-col overflow-hidden">
      <div className="bg-rf-surface-2 max-rf:bg-rf-bg flex min-h-0 flex-1">
        <Sidebar
          open={open}
          onToggle={toggle}
          isGuest={isGuest}
          guestSessionTitle={firstQuestion(messages)}
          searchOpen={searchOpen}
          onToggleSearch={() => {
            setSearchOpen((value) => {
              if (value) list.setQuery("");
              return !value;
            });
          }}
          query={list.query}
          onQueryChange={list.setQuery}
          grouped={list.grouped}
          chats={list.chats}
          noMatches={list.noMatches}
          activeChatId={activeChatId}
          onNewChat={newChat}
          onOpenChat={(id) => void openChat(id)}
          onRenameChat={(id, title) => void list.rename(id, title)}
          onDeleteChat={(id) => {
            // the open conversation was just deleted; keep it on screen but
            // detach it so the next turn starts a new record
            if (id === activeChatId) setChatId(null);
            void list.remove(id);
          }}
          onRequestSignIn={() => requestSignIn("history")}
        />

        <div
          className={cn(
            "bg-rf-bg flex min-h-0 min-w-0 flex-1 flex-col",
            "border-rf-line max-rf:border-s-0 border-s",
          )}
        >
          <Topbar
            viewer={viewer}
            onNewChat={newChat}
            onOpenHistory={() => {
              if (isGuest) {
                requestSignIn("history");
                return;
              }
              setDrawerOpen(true);
            }}
            onSignIn={() => setPromptOpen(true)}
          />

          {/* The conversation container is edge-to-edge and owns its own
              scrolling; the frame must not scroll, or the composer leaves the
              viewport on a phone. */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-transparent">
            {children}
          </div>
        </div>
      </div>

      {/* history as a drawer where there is no rail */}
      <Drawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="سجل المحادثات"
        footer={
          <>
            <Button variant="tonal" size="sm" block onClick={newChat}>
              <Icon name="plus" size="sm" />
              محادثة جديدة
            </Button>
            <Input
              value={list.query}
              aria-label="بحث في المحادثات"
              placeholder="ابحث في المحادثات"
              onChange={(event) => list.setQuery(event.target.value)}
            />
          </>
        }
      >
        <HistoryRail
          grouped={list.grouped}
          chats={list.chats}
          noMatches={list.noMatches}
          activeChatId={activeChatId}
          onOpen={(id) => void openChat(id)}
          onRename={(id, title) => void list.rename(id, title)}
          onDelete={(id) => {
            if (id === activeChatId) setChatId(null);
            void list.remove(id);
          }}
        />
      </Drawer>

      <GuestWall reason={wall} onClose={() => setWall(null)} />
      <SignInPrompt open={promptOpen} onClose={() => setPromptOpen(false)} />
    </div>
  );
}
