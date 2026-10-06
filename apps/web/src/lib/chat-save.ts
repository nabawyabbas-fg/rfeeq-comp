/**
 * When a conversation save would write exactly what is already stored.
 *
 * A leaf module on purpose: it imports nothing. `chat-history.ts`, its natural
 * home, reaches the database and the session and therefore `@/env`, whose
 * extended schemas (Stripe, Pinecone, storage) make it uncollectable in a unit
 * test — the same trap `sources/web-search.ts` documents for its API key. This
 * is the part of the save path that can be wrong, so it has to be testable.
 */

/** A stored message, as the save path needs to compare it. */
interface StoredRow {
  position: number;
  metadata?: unknown;
}

/** A message about to be written. */
interface IncomingRow {
  parts: unknown;
  metadata?: unknown;
}

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Whether a save would write exactly what is already stored.
 *
 * `updatedAt` is what the history rail sorts on, so a write is what decides a
 * conversation's place in the list. Loading a conversation puts its messages
 * into client state with the run already finished — the exact shape the
 * persistence hook saves — so opening an old conversation posted it straight
 * back and floated it to the top. The rail sorted by last *opened* while
 * claiming to sort by last changed.
 *
 * The guard is here rather than only in the client because the client cannot be
 * sure of its own ordering: the messages and the chat id are set from two
 * different stores, and when the messages land a render later the hook has
 * already recorded an empty conversation as "saved". Comparing against what is
 * stored is the one check that cannot be raced.
 *
 * Three things count as a change, and all three must:
 *
 * - **the count**, which is a new turn;
 * - **the last row's parts**, which is a regenerated one;
 * - **any row's metadata** — the metrics that land a beat after the stream
 *   finishes, and the follow-up suggestions, which are generated per answer and
 *   so can appear on a message part-way up the thread. Comparing only the last
 *   row's metadata would quietly discard both.
 *
 * What it deliberately does not detect is an edit to the parts of a message
 * that is not the last. Nothing in the product produces one: regenerating
 * rewrites from that turn onward, so the last row changes, and editing an
 * earlier question truncates the conversation, so the count does.
 */
export const saveIsNoOp = (
  stored: StoredRow[],
  /** The stored last row's parts, fetched separately — the only large field. */
  storedLastParts: unknown,
  rows: IncomingRow[],
): boolean => {
  const incoming = rows[rows.length - 1];
  if (stored.length !== rows.length || !incoming) return false;
  if (!same(storedLastParts, incoming.parts)) return false;

  // positions are 0-based and contiguous; compare metadata row for row
  const byPosition = [...stored].sort((a, b) => a.position - b.position);
  return byPosition.every((row, index) =>
    same(row.metadata, rows[index]?.metadata),
  );
};
