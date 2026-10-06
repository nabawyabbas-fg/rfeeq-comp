"use client";

import type { MyUIMessage } from "@/types/ai";
import { useCallback, useState } from "react";
import { useActiveChat } from "@/components/chat/active-chat.store";
import { useChatPersistence } from "@/components/chat/use-chat-persistence";
import { useCorpus, useIsGuest, useViewer } from "@/contexts/rfeeq-context";
import {
  useChatMessages,
  useChatProperty,
  useChatStatus,
} from "ai-sdk-zustand";

import type { GuestWallReason } from "../auth/guest-wall";
import { GuestWall } from "../auth/guest-wall";
import { RfeeqShell } from "../shell/shell";
import { Composer, ComposerNote } from "./composer";
import { ChatHome } from "./home";
import { ShareDialog } from "./share-dialog";
import { RfeeqSourcesHost } from "./sources";
import { Thread } from "./thread";
import { useLoadChat } from "./use-load-chat";
import { useGuestQuota, useRfeeqChat } from "./use-rfeeq-chat";

/**
 * The chat surface: the opening screen until a question is asked, the thread
 * afterwards.
 *
 * The chat hook is called here, above the shell, on purpose. The rail's "new
 * chat" and "open conversation" write to the same store this hook owns, and a
 * parent rendering before its child would read that store before the hook had
 * synced it.
 */
export function RfeeqChat({ initialChatId }: { initialChatId?: string }) {
  // owns the store for everything below, the shell included
  useRfeeqChat();

  const corpus = useCorpus();
  const viewer = useViewer();
  const isGuest = useIsGuest();

  const messages = useChatMessages<MyUIMessage>();
  const status = useChatStatus();
  const sendMessage = useChatProperty((state) => state.sendMessage);
  const stop = useChatProperty((state) => state.stop);
  const chatId = useActiveChat((state) => state.chatId);

  const [draft, setDraft] = useState("");
  const [wall, setWall] = useState<GuestWallReason | null>(null);
  const [sharing, setSharing] = useState<MyUIMessage | null>(null);

  const quota = useGuestQuota(isGuest);

  // A conversation opened by URL. Loaded once, here rather than in the shell,
  // because the store this writes to is the one created above.
  useLoadChat(initialChatId);

  /*
   * Saved after each completed turn. A guest's conversation is saved too,
   * keyed to a visitor cookie — which is what lets it be handed over to their
   * account on sign-in, exactly as the wall promises.
   */
  useChatPersistence({
    /*
     * No namespace. Conversations here belong to no corpus — retrieval is live
     * from the approved platforms — and the column is nullable for exactly
     * that. Passing an invented id instead violated the foreign key and failed
     * every save silently, which is why history was empty.
     */
    ...(corpus ? { namespaceId: corpus.id } : {}),
    enabled: true,
  });

  const busy = status === "streaming" || status === "submitted";

  const ask = useCallback(
    (question: string) => {
      const text = question.trim();
      if (!text || busy) return;

      // The limit is checked at the point of asking rather than on arrival, so
      // a guest reads their three answers in full and meets the wall only when
      // they ask for a fourth.
      if (quota.exhausted) {
        setWall("limit");
        return;
      }

      if (isGuest) quota.consume();
      setDraft("");
      void sendMessage({ role: "user", parts: [{ type: "text", text }] });
    },
    [busy, isGuest, quota, sendMessage],
  );

  /*
   * A guest cannot share: the link would outlive their session and leave
   * nobody able to revoke it. Decided here rather than inside the dialog,
   * which would mean a child telling its parent to open a wall during render.
   */
  const share = useCallback(
    (message: MyUIMessage) => {
      if (isGuest) {
        setWall("share");
        return;
      }
      setSharing(message);
    },
    [isGuest],
  );

  const isEmpty = messages.length === 0;

  const composer = (
    <Composer
      value={draft}
      onChange={setDraft}
      onSubmit={() => ask(draft)}
      busy={busy}
      onStop={() => void stop()}
      autoFocus={isEmpty}
    />
  );

  return (
    <RfeeqShell>
      {isEmpty ? (
        <ChatHome
          name={viewer?.name ?? null}
          welcome={corpus?.welcomeMessage ?? null}
          composer={composer}
          onPick={(question) => {
            // fills the field rather than sending, leaving the reader in
            // control of the question that gets asked
            setDraft(question);
          }}
        />
      ) : (
        /* the panel docks beside both: a reader comparing a ruling against
           its source should still be able to type */
        <RfeeqSourcesHost>
          <Thread onFollowUp={ask} onShare={share} />

          <div className="from-rf-bg shrink-0 bg-gradient-to-t from-80% px-5 pt-2 pb-4">
            <div className="mx-auto grid max-w-180 gap-2">
              {composer}
              <ComposerNote />
            </div>
          </div>
        </RfeeqSourcesHost>
      )}

      <GuestWall reason={wall} onClose={() => setWall(null)} />
      <ShareDialog
        message={sharing}
        chatId={chatId}
        onClose={() => setSharing(null)}
      />
    </RfeeqShell>
  );
}
