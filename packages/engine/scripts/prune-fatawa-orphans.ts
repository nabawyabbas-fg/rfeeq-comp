/**
 * Removes fatwa points that no longer correspond to any chunk on disk.
 *
 * The corpus was chunked more than once, and an earlier run split fatwas at
 * different boundaries. The ingest reuses a vector only when the stored text is
 * byte-identical, so chunks whose boundaries moved were re-embedded under new
 * ids — leaving the superseded points behind. They are unreachable by citation
 * but still answer searches, so they have to go.
 *
 * The chunk files are the authority: any point whose `_id` is not among them is
 * an orphan.
 *
 *   bun run scripts/prune-fatawa-orphans.ts --dry-run
 *   bun run scripts/prune-fatawa-orphans.ts
 */
import { readdir } from "node:fs/promises";
import { join } from "node:path";

const arg = (name: string, fallback?: string) => {
  const hit = Bun.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : fallback;
};
const flag = (name: string) => Bun.argv.includes(`--${name}`);

const CHUNK_DIR = process.env.FATAWA_CHUNKS ?? "/data/fatawa/chunks";
const QDRANT = arg("qdrant", "http://localhost:6333")!;
const COLLECTION = arg("collection", "as_fatawa")!;
const DRY = flag("dry-run");

const api = async (path: string, body: unknown, method = "POST") => {
  const res = await fetch(`${QDRANT}/collections/${COLLECTION}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return (await res.json()) as { result: any };
};

// the id the ingest writes: `${documentId}#${sequenceNumber}`
const expected = new Set<string>();
const files = (await readdir(CHUNK_DIR)).filter((f) => f.endsWith(".jsonl"));
if (!files.length) throw new Error(`no chunk files in ${CHUNK_DIR}; refusing`);

for (const file of files) {
  const text = await Bun.file(join(CHUNK_DIR, file)).text();
  for (const line of text.split("\n")) {
    if (!line) continue;
    const c = JSON.parse(line) as {
      documentId: string;
      metadata: { sequenceNumber?: number };
    };
    expected.add(`${c.documentId}#${c.metadata.sequenceNumber ?? 0}`);
  }
}
console.log(`chunk files : ${files.length}`);
console.log(`expected ids: ${expected.size.toLocaleString()}\n`);

let offset: string | undefined;
let scanned = 0;
let orphans = 0;
const started = Date.now();

for (;;) {
  const { result } = await api("/points/scroll", {
    limit: 4096,
    with_payload: ["_id"],
    with_vector: false,
    ...(offset ? { offset } : {}),
  });
  const points: { id: string; payload: { _id: string } }[] = result.points;
  if (!points.length) break;

  const doomed = points
    .filter((p) => !expected.has(p.payload._id))
    .map((p) => p.id);
  scanned += points.length;
  orphans += doomed.length;

  if (!DRY && doomed.length) {
    await api("/points/delete?wait=true", { points: doomed });
  }

  offset = result.next_page_offset ?? undefined;
  process.stdout.write(
    `\r  scanned ${scanned.toLocaleString()}  orphans ${orphans.toLocaleString()}  ` +
      `${((Date.now() - started) / 1000).toFixed(0)}s   `,
  );
  if (!offset) break;
}

console.log(`\n\n${DRY ? "DRY RUN — nothing deleted" : "done"}`);
console.log(`  scanned : ${scanned.toLocaleString()}`);
console.log(`  orphans : ${orphans.toLocaleString()}`);
console.log(`  kept    : ${(scanned - orphans).toLocaleString()}`);
