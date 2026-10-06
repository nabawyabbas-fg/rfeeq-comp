import { saveIsNoOp } from "@/lib/chat-save";
import { describe, expect, it } from "vitest";

/**
 * Why the history rail sorted by last *opened*.
 *
 * Loading a conversation puts its messages into client state with the run
 * already finished, which is the exact shape the persistence hook saves. So
 * merely opening an old conversation posted it straight back, rewrote every
 * row, bumped `updatedAt`, and floated it to the top of a list that sorts on
 * `updatedAt desc`. The database showed it plainly: five conversations created
 * hours apart, two to four messages each, all updated within fifteen seconds —
 * somebody reading down the list.
 *
 * The guard is server-side because the client cannot be sure of its own
 * ordering: the messages and the chat id come from two different stores, and
 * when the messages land a render later the hook has already recorded an empty
 * conversation as "saved". Comparing against what is stored cannot be raced.
 */
const ask = { parts: [{ type: "text", text: "ما درجته؟" }] };
const answer = { parts: [{ type: "text", text: "الحديث صحيح" }] };

/** The stored side: metadata for every row, parts for the last one only. */
const storedRows = (...metadata: unknown[]) =>
  metadata.map((m, position) => ({ position, metadata: m }));

describe("a save that changes nothing", () => {
  it("is a no-op, so opening a conversation cannot reorder the list", () => {
    expect(
      saveIsNoOp(storedRows(null, null), answer.parts, [ask, answer]),
    ).toBe(true);
  });

  it("is not a no-op when a turn was added", () => {
    expect(
      saveIsNoOp(storedRows(null, null), answer.parts, [
        ask,
        answer,
        { parts: [{ type: "text", text: "وما تخريجه؟" }] },
      ]),
    ).toBe(false);
  });

  it("is not a no-op when the last turn was regenerated", () => {
    expect(
      saveIsNoOp(storedRows(null, null), answer.parts, [
        ask,
        { parts: [{ type: "text", text: "الحديث حسن" }] },
      ]),
    ).toBe(false);
  });

  /*
   * The metrics ride on the stream's finish event and can land after the first
   * save. Treating that as a no-op would leave half the turns with no cost or
   * latency recorded.
   */
  it("is not a no-op when the metrics arrive late", () => {
    expect(
      saveIsNoOp(storedRows(null, null), answer.parts, [
        ask,
        { ...answer, metadata: { metrics: { totalTokens: 900 } } },
      ]),
    ).toBe(false);
  });

  /*
   * Follow-ups are generated per answer and rendered under every one, so a
   * message part-way up a thread can acquire a set. A guard that only looked at
   * the newest row would drop it, and the conversation would regenerate the
   * same suggestions on every reload — which is the whole point of storing
   * them.
   */
  it("is not a no-op when an earlier answer gains follow-ups", () => {
    const fourRows = [ask, answer, ask, answer];
    expect(
      saveIsNoOp(storedRows(null, null, null, null), answer.parts, [
        ask,
        { ...answer, metadata: { followUps: ["وما تخريجه؟"] } },
        ask,
        answer,
      ]),
    ).toBe(false);
    // and once stored, saving the same thing again writes nothing
    expect(
      saveIsNoOp(
        storedRows(null, { followUps: ["وما تخريجه؟"] }, null, null),
        answer.parts,
        [
          ask,
          { ...answer, metadata: { followUps: ["وما تخريجه؟"] } },
          ask,
          answer,
        ],
      ),
    ).toBe(true);
    expect(fourRows).toHaveLength(4);
  });

  it("is not a no-op for a conversation with nothing stored yet", () => {
    expect(saveIsNoOp([], undefined, [answer])).toBe(false);
  });

  /* rows may come back in any order; metadata is matched by position */
  it("compares metadata by position, not by arrival order", () => {
    const shuffled = [
      { position: 1, metadata: { followUps: ["س؟"] } },
      { position: 0, metadata: null },
    ];
    expect(
      saveIsNoOp(shuffled, answer.parts, [
        ask,
        { ...answer, metadata: { followUps: ["س؟"] } },
      ]),
    ).toBe(true);
  });
});
