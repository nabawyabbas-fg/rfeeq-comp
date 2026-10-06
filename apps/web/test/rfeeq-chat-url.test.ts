import { historyMethod, pathFor } from "@/components/rfeeq/shell/use-chat-url";
import { describe, expect, it } from "vitest";

/**
 * The open conversation lives in the path, not in a query parameter.
 *
 * `app/(rfeeq)/c/[chatId]/page.tsx` already renders the chat surface with
 * `initialChatId`, and `useLoadChat` fetches the conversation into the store. A
 * `?c=<id>` on `/` looked identical in the address bar and was not the same
 * thing: `/` renders the chat with no id, so a reload landed on an empty chat
 * whatever the URL said.
 */
describe("where a conversation lives", () => {
  it("is the route built to serve it", () => {
    expect(pathFor("cmuw123")).toBe("/c/cmuw123");
  });

  it("is the root when the conversation has no record yet", () => {
    expect(pathFor(null)).toBe("/");
  });
});

/**
 * Which history entries exist decides what Back does.
 */
describe("push or replace", () => {
  /*
   * A conversation has no id until its first save lands. Pushing there would
   * put an entry in the history for a conversation the reader never left, so
   * Back would appear to do nothing — landing on the same conversation, a
   * moment before it had an id.
   */
  it("replaces when a conversation acquires its id", () => {
    expect(historyMethod(null, "cmuw123")).toBe("replaceState");
  });

  it("pushes when another conversation is opened", () => {
    expect(historyMethod("cmuwA", "cmuwB")).toBe("pushState");
  });

  it("pushes when a conversation is left for a blank page", () => {
    expect(historyMethod("cmuwA", null)).toBe("pushState");
  });
});
