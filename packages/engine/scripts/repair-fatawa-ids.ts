/**
 * Repairs fatwa point ids written before the ingest script's `documentId` was
 * fixed. Those points carry `_id = "turath-undefined#fatwa-<source>-<id>-<lang>:<n>"`,
 * so every fatwa chunk shares the document id "turath-undefined" and citations
 * name a book that doesn't exist.
 *
 * The correct id is `fatwa-<source>-<id>-<lang>#<n>`, rebuilt from the payload
 * rather than parsed out of the broken string. The Qdrant point uuid is derived
 * from `_id`, so a repair means writing a new point and deleting the old one —
 * but the vectors are carried across untouched, so nothing is re-embedded.
 *
 *   bun run scripts/repair-fatawa-ids.ts --collection=as_fatawa --dry-run
 *   bun run scripts/repair-fatawa-ids.ts --collection=as_fatawa
 */
import { createHash } from "node:crypto";

const arg = (name: string, fallback?: string) => {
  const hit = Bun.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : fallback;
};
const flag = (name: string) => Bun.argv.includes(`--${name}`);

const QDRANT = arg("qdrant", "http://localhost:6333")!;
const COLLECTION = arg("collection")!;
const BATCH = Number(arg("batch", "256"));
const MAX = Number(arg("max", "0")); // 0 = no limit
const DRY = flag("dry-run");

if (!COLLECTION) throw new Error("--collection is required");

// same derivation the Qdrant store uses, so repaired points land where a
// re-ingest of the same chunk would
const toPointId = (id: string): string => {
  const hash = createHash("sha1").update(id).digest("hex").slice(0, 32);
  const bytes = hash.split("");
  bytes[12] = "5";
  bytes[16] = "8";
  const hex = bytes.join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
};

const api = async (path: string, body?: unknown, method = "POST") => {
  const res = await fetch(`${QDRANT}/collections/${COLLECTION}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return (await res.json()) as { result: any };
};

interface Point {
  id: string;
  payload: Record<string, unknown>;
  vector: Record<string, unknown>;
}

const correctId = (payload: Record<string, unknown>) => {
  const { source, fatwaId, language, sequenceNumber } = payload;
  if (!source || fatwaId === undefined || !language) return null;
  return `fatwa-${source}-${fatwaId}-${language}#${sequenceNumber ?? 0}`;
};

let offset: string | undefined;
let scanned = 0;
let repaired = 0;
let alreadyOk = 0;
let unparseable = 0;
const started = Date.now();

for (;;) {
  const { result } = await api("/points/scroll", {
    limit: BATCH,
    with_payload: true,
    with_vector: true,
    ...(offset ? { offset } : {}),
  });

  const points: Point[] = result.points;
  if (!points.length) break;

  const toWrite: { id: string; vector: unknown; payload: unknown }[] = [];
  const toDelete: string[] = [];

  for (const p of points) {
    scanned++;
    const current = p.payload._id as string | undefined;
    const wanted = correctId(p.payload);
    if (!wanted) {
      unparseable++;
      continue;
    }
    if (current === wanted) {
      alreadyOk++;
      continue;
    }
    const newPointId = toPointId(wanted);
    toWrite.push({
      id: newPointId,
      vector: p.vector,
      payload: { ...p.payload, _id: wanted },
    });
    // a point whose uuid is unchanged would be deleted right after being
    // written; only remove ids the repair actually moved away from
    if (newPointId !== p.id) toDelete.push(p.id);
    repaired++;
  }

  if (!DRY && toWrite.length) {
    await api("/points?wait=true", { points: toWrite }, "PUT");
    if (toDelete.length) {
      await api("/points/delete?wait=true", { points: toDelete });
    }
  }

  offset = result.next_page_offset ?? undefined;
  process.stdout.write(
    `\r  scanned ${scanned.toLocaleString()}  repaired ${repaired.toLocaleString()}  ` +
      `ok ${alreadyOk.toLocaleString()}  skipped ${unparseable.toLocaleString()}  ` +
      `${((Date.now() - started) / 1000).toFixed(0)}s   `,
  );

  if (!offset) break;
  if (MAX && scanned >= MAX) break;
}

console.log(`\n\n${DRY ? "DRY RUN — nothing written" : "done"}`);
console.log(`  scanned    : ${scanned.toLocaleString()}`);
console.log(`  repaired   : ${repaired.toLocaleString()}`);
console.log(`  already ok : ${alreadyOk.toLocaleString()}`);
console.log(`  skipped    : ${unparseable.toLocaleString()}`);
