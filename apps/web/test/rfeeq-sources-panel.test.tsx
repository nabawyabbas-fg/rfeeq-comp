import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CHAT = join(import.meta.dirname, "../src/components/rfeeq/chat");
const read = (name: string) => readFileSync(join(CHAT, name), "utf8");

/**
 * A single-column grid has to say `minmax(0, 1fr)`.
 *
 * A bare `grid` gets one *auto* track, and an auto track is sized to its items'
 * max-content. In the sources pane that was the longest source title in full —
 * «التفسير الميسر، مجمع الملك فهد لطباعة المصحف الشريف» — so every card grew
 * wider than the pane and the whole thing scrolled sideways. The titles already
 * carry `truncate`; they never got the chance, because the track was as wide as
 * they were. The history rail was widened by exactly this once before.
 */
describe("grids inside a fixed-width pane", () => {
  const files = [
    "sources.tsx",
    "sciences-panel.tsx",
    "hadith-panel.tsx",
    "share-dialog.tsx",
    "feedback-dialog.tsx",
  ];

  it("never leaves a track sized to its content", () => {
    const bare = files.flatMap((name) =>
      read(name)
        .split("\n")
        .map((line, index) => ({ name, line, number: index + 1 }))
        .filter(({ line }) => /\bgrid gap-/.test(line)),
    );
    expect(bare).toEqual([]);
  });

  it("stops the pane scrolling sideways at all", () => {
    expect(read("sources.tsx")).toContain("overflow-x-hidden");
  });
});

/**
 * The āya is what the answer is *about*, not a source it rests on.
 *
 * It is already shown in full, in the muṣḥaf hand, with its sūra and number and
 * with علوم الآية a tap away. A row reading «Qur'an 9:15 · موسوعة القرآن» under
 * that adds nothing and pushes the commentaries — which are sources a reader
 * may want to weigh — down the list.
 */
describe("the sources list", () => {
  const source = read("sources.tsx");

  it("drops a document whose chunks are all verses", () => {
    expect(source).toMatch(
      /sources = useMemo\([\s\S]{0,400}kindOf\(chunk\) === "quran"/,
    );
  });

  /*
   * The verse must stay resolvable even though it is not listed: the scripture
   * section renders the āya *from its chunk*, and losing it would fall the
   * section back to the model's own prose — the one thing scripture must never
   * be.
   */
  it("keeps every retrieved chunk in the index that sections resolve against", () => {
    expect(source).toMatch(/for \(const source of retrieved\)/);
    expect(source).toMatch(/\}, \[retrieved\]\);/);
  });
});

/**
 * A truncated source name is reachable in full, the way a truncated
 * conversation name is in the history rail.
 *
 * The part that gets cut is the part worth reading: «التفسير الميسر، مجمع
 * الملك فهد لطباعة المصحف الشريف» carries its edition at the end, which is
 * exactly what a reader checking a citation wants.
 */
describe("a long source name", () => {
  const source = read("sources.tsx");

  it("offers the whole title on hover", () => {
    expect(source).toMatch(/title=\{source\.title\}/);
  });

  it("offers the whole subtitle too", () => {
    expect(source).toMatch(/title=\{source\.subtitle\}/);
  });

  it("still truncates rather than widening the card", () => {
    expect(source).toMatch(/title=\{source\.title\}[\s\S]{0,160}truncate/);
  });
});

/**
 * The panel must never outlive the answer it belongs to.
 *
 * Its state is a *snapshot* of one answer's sources, keyed to that answer's id.
 * Opening another conversation replaces every message on screen but left the
 * panel untouched — so a hadith answer sat beside «المصادر (3)» listing
 * الطبري، ابن كثير والسعدي, read in the verse question before it.
 */
describe("switching conversations", () => {
  const host = read("sources.tsx");

  it("closes the panel on a real switch", () => {
    expect(host).toMatch(/seenChatId !== chatId/);
    expect(host).toMatch(/if \(seenChatId !== null\) setState\(null\)/);
  });

  /*
   * A conversation has no id until its first save lands, so `null → id` is this
   * conversation acquiring a record rather than a move to another one. Closing
   * there would shut the panel under a reader who opened it moments earlier.
   */
  it("does not close when a new conversation acquires its id", () => {
    expect(host).toContain("if (seenChatId !== null)");
  });

  /*
   * Watching the chat id, not the messages: those change on every streamed
   * token, and the host wraps the whole thread.
   */
  it("watches the chat id rather than the message list", () => {
    expect(host).toMatch(/useActiveChat\(\(chat\) => chat\.chatId\)/);
    expect(host).not.toMatch(/RfeeqSourcesHost[\s\S]{0,600}useChatProperty/);
  });
});

/**
 * Who published it, and where in it — two facts, two lines.
 *
 * They shared one slot with a fallback, so whichever came first won: a hadith
 * always carries a grading, so «موسوعة الحديث» was never shown for one, while a
 * Dorar page — which has no grading field — did show its publisher. The same
 * card named its publisher *or* its reference depending on what kind of source
 * it happened to be.
 */
describe("a source card's attribution", () => {
  const card = read("sources.tsx");

  it("always names the publisher", () => {
    expect(card).toMatch(/\{source\.corpus\}/);
    expect(card).not.toMatch(/sourceReference\(source\) \?\? source\.corpus/);
  });

  it("adds the reference beneath it when there is one", () => {
    expect(card).toMatch(/const reference = sourceReference\(source\)/);
    expect(card).toMatch(/\{reference \? \(/);
  });
});
