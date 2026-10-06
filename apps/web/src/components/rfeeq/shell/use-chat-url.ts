"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * The open conversation, reflected in the address bar as `/c/<id>`.
 *
 * So it can be bookmarked, opened in another tab, sent to another device, and
 * reached with the browser's own Back button.
 *
 * **The path, not a query parameter.** `app/(rfeeq)/c/[chatId]/page.tsx` already
 * exists and already works: it renders the same chat surface with
 * `initialChatId`, and `useLoadChat` fetches the conversation into the store. A
 * `?c=<id>` on `/` looked identical in the address bar and was not the same
 * thing at all — `/` renders `RfeeqChat` with no id, so a refresh landed on an
 * empty chat no matter what the URL said. Writing the real route means a reload
 * is served by the page built for it.
 *
 * `history.pushState` rather than `router.push`: the conversation is already in
 * the store when this runs, so asking Next to render the route again would
 * fetch and replace what is on screen. On a *reload* the route does the work,
 * which is the division this relies on.
 */

/** Kept only to rewrite the links this briefly published. */
const LEGACY_PARAM = "c";

const CHAT_PATH = /^\/c\/([^/?#]+)/;

const chatIdInUrl = () => CHAT_PATH.exec(window.location.pathname)?.[1] ?? null;

/** Where a conversation lives, preserving anything else on the URL. */
export const pathFor = (chatId: string | null) =>
  chatId ? `/c/${chatId}` : "/";

/**
 * Whether this change is a navigation or the same conversation being named for
 * the first time.
 *
 * `null → id` is a conversation acquiring a record on its first save. Pushing
 * there would put an entry in the history for a conversation the reader never
 * left, so Back would appear to do nothing — it would land on the same
 * conversation, a moment before it had an id.
 */
export const historyMethod = (
  before: string | null,
  after: string | null,
): "pushState" | "replaceState" =>
  before === null && after !== null ? "replaceState" : "pushState";

export function useChatUrl({
  activeChatId,
  openChat,
  startNew,
  enabled,
}: {
  /** The conversation on screen, or null for one with no record yet. */
  activeChatId: string | null;
  openChat: (chatId: string) => void;
  /** Leave the current conversation for an empty one. */
  startNew: () => void;
  /** False for a guest, whose conversations are never saved. */
  enabled: boolean;
}) {
  /*
   * What the address bar is believed to say. A ref, because it has to be set
   * *before* a Back handler acts: without that the write-back below would read
   * the change as navigation and push a fresh entry, so Back would walk
   * forward.
   */
  const shown = useRef<string | null>(activeChatId);

  /* ---- a link published as `?c=…` becomes the route it meant ---- */
  const rewritten = useRef(false);
  useEffect(() => {
    if (rewritten.current) return;
    rewritten.current = true;

    const url = new URL(window.location.href);
    const legacy = url.searchParams.get(LEGACY_PARAM);
    if (!legacy || chatIdInUrl()) return;

    url.searchParams.delete(LEGACY_PARAM);
    // replace, not push: the reader did not navigate, the link was just old
    window.history.replaceState(null, "", `/c/${legacy}${url.search}${url.hash}`);
    shown.current = legacy;
    if (enabled && legacy !== activeChatId) openChat(legacy);
  }, [enabled, activeChatId, openChat]);

  /* ---- write the open conversation back to the address bar ---- */
  useEffect(() => {
    if (shown.current === activeChatId) return;
    const before = shown.current;
    shown.current = activeChatId;

    const url =
      pathFor(activeChatId) + window.location.search + window.location.hash;
    window.history[historyMethod(before, activeChatId)](null, "", url);
  }, [activeChatId]);

  /* ---- follow the browser's own Back and Forward ---- */
  const onPopState = useCallback(() => {
    if (!enabled) return;
    const id = chatIdInUrl();
    if (id === shown.current) return;

    // set first, act second: the write-back above must see this as already
    // reflected, or it pushes an entry and Back starts walking forward
    shown.current = id;
    if (id) openChat(id);
    else startNew();
  }, [enabled, openChat, startNew]);

  useEffect(() => {
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [onPopState]);
}
