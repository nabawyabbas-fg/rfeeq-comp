/**
 * Embeds the pre-chunked fatwa corpus into its own Qdrant collection.
 *
 * Deliberately a separate collection from turath rather than a filter over one:
 * the two are asked different questions and will be selectable independently.
 * Both are embedded with the same model so scores from them are comparable when
 * results are merged.
 *
 * Chunking is not done here — `fatawa-chunker/run.py` produces the chunks, one
 * per fatwa, using the same vendored chunker as turath.
 *
 *   bun run scripts/ingest-fatawa.ts --model=text-embedding-3-large --max-usd=10
 */
import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { createOpenAI } from "@ai-sdk/openai";
import { embedMany } from "ai";

import { Qdrant } from "../src/vector-store/qdrant/index";

const CHUNK_DIR = process.env.FATAWA_CHUNKS ?? "/data/fatawa/chunks";
const QDRANT_URL = process.env.QDRANT_URL ?? "http://localhost:6333";

/** USD per 1M input tokens, as published for the embeddings endpoint. */
const PRICE_PER_MTOK: Record<string, number> = {
  "text-embedding-3-small": 0.02,
  "text-embedding-3-large": 0.13,
};

interface Chunk {
  id: string;
  /** emitted by the chunker; unlike turath it is not derived from the id here */
  documentId: string;
  text: string;
  metadata: Record<string, string | number | boolean | string[]>;
}

/**
 * The point id the Qdrant store derives from a chunk id. Duplicated here rather
 * than imported so the reuse check below can ask for points by id without
 * going through the store's query surface.
 */
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

/**
 * Ids whose vector is already in the collection *and* whose stored text is
 * byte-identical to the chunk we are about to embed.
 *
 * This corpus has been chunked more than once, and re-embedding what did not
 * change is the difference between a few dollars and thirty. Text equality is
 * the whole test: a chunk whose boundaries moved is a different chunk and gets
 * embedded again, so a reused vector always matches the text it is stored with.
 *
 * Fails open — if the lookup errors, everything in the batch is embedded.
 */
const findReusable = async (
  collection: string,
  wanted: { id: string; text: string }[],
): Promise<Set<string>> => {
  try {
    const res = await fetch(`${QDRANT_URL}/collections/${collection}/points`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ids: wanted.map((w) => toPointId(w.id)),
        with_payload: ["_id", "text"],
        with_vector: false,
      }),
    });
    if (!res.ok) return new Set();
    const { result } = (await res.json()) as {
      result: { payload: { _id: string; text: string } }[];
    };
    const stored = new Map(result.map((p) => [p.payload._id, p.payload.text]));
    return new Set(
      wanted.filter((w) => stored.get(w.id) === w.text).map((w) => w.id),
    );
  } catch {
    return new Set();
  }
};

const arg = (name: string, fallback?: string) => {
  const hit = Bun.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : fallback;
};

const main = async () => {
  const apiKey = process.env.EMBED_API_KEY;
  if (!apiKey) throw new Error("EMBED_API_KEY is required");

  const modelName = arg("model", "text-embedding-3-small")!;
  const namespaceId = arg("namespace", "fatawa")!;
  const batchSize = Number(arg("batch", "96"));

  // Hard ceiling. Embedding is billed per token and this corpus is large enough
  // that an unbounded run is a real financial risk, so the budget is enforced
  // against reported usage rather than an estimate, and checked every batch.
  const maxUsd = Number(arg("max-usd", "15"));
  // A batch can be bounded by files as well as by spend, so a run can be sized
  // to something observable rather than only to a budget.
  const maxFiles = arg("max-files") ? Number(arg("max-files")) : Infinity;
  const pricePerMTok = PRICE_PER_MTOK[modelName];
  if (pricePerMTok === undefined) {
    throw new Error(`Unknown price for model ${modelName}; refusing to run`);
  }
  const maxTokens = (maxUsd / pricePerMTok) * 1_000_000;

  const openai = createOpenAI({
    apiKey,
    ...(process.env.EMBED_BASE_URL
      ? { baseURL: process.env.EMBED_BASE_URL }
      : {}),
  });
  const model = openai.textEmbeddingModel(modelName);
  const store = new Qdrant({ url: QDRANT_URL, namespaceId });

  const files = (await readdir(CHUNK_DIR)).filter((f) => f.endsWith(".jsonl"));

  const donePath = join(CHUNK_DIR, `.ingested-${namespaceId}.json`);
  const done = new Set<string>(
    (await Bun.file(donePath).exists())
      ? ((await Bun.file(donePath).json()) as string[])
      : [],
  );

  console.log(`model     : ${modelName} ($${pricePerMTok}/Mtok)`);
  console.log(
    `budget    : $${maxUsd.toFixed(2)} → ${(maxTokens / 1e6).toFixed(1)}M tokens`,
  );
  if (Number.isFinite(maxFiles))
    console.log(`batch     : max ${maxFiles} files`);
  console.log(
    `chunks in : ${CHUNK_DIR} (${files.length} files, ${done.size} already done)`,
  );
  console.log(`qdrant    : ${QDRANT_URL} ns=${namespaceId}\n`);

  let tokens = 0;
  let embedded = 0;
  let reused = 0;
  let filesDone = 0;
  let stopped = false;
  const started = Date.now();

  for (const file of files) {
    if (stopped) break;
    if (filesDone >= maxFiles) {
      console.log(`\n\nBATCH LIMIT — ${maxFiles} files reached`);
      stopped = true;
      break;
    }
    if (done.has(file)) continue;

    const lines = (await Bun.file(join(CHUNK_DIR, file)).text())
      .split("\n")
      .filter(Boolean);
    const chunks = lines.map((l) => JSON.parse(l) as Chunk);
    if (!chunks.length) continue;

    for (let i = 0; i < chunks.length; i += batchSize) {
      if (tokens >= maxTokens) {
        console.log(`\n\nBUDGET REACHED — stopping before book ${file}`);
        stopped = true;
        break;
      }

      const batch = chunks.slice(i, i + batchSize).map((chunk) => ({
        chunk,
        // the chunker's id repeats the documentId ("fatwa-islamqa-1-en:0"), and
        // the store joins documentId and chunk id as `documentId#chunkId`.
        // Models drop the duplicated half when citing, so keep the chunk id to
        // the position alone: "fatwa-islamqa-1-en#0".
        chunkId: String(chunk.metadata.sequenceNumber ?? 0),
        id: `${chunk.documentId}#${chunk.metadata.sequenceNumber ?? 0}`,
      }));

      const keep = await findReusable(
        `as_${namespaceId}`,
        batch.map((b) => ({ id: b.id, text: b.chunk.text })),
      );
      const todo = batch.filter((b) => !keep.has(b.id));
      reused += keep.size;
      if (!todo.length) continue;

      const result = await embedMany({
        model,
        values: todo.map((b) => b.chunk.text),
      });

      tokens += result.usage?.tokens ?? 0;
      embedded += todo.length;

      await store.upsert({
        chunks: todo.map((b, j) => ({
          documentId: b.chunk.documentId,
          chunk: {
            id: b.chunkId,
            text: b.chunk.text,
            metadata: b.chunk.metadata,
          },
          embedding: result.embeddings[j]!,
        })) as never,
      });
    }

    if (!stopped) {
      done.add(file);
      filesDone++;
      if (filesDone % 5 === 0) {
        await Bun.write(donePath, JSON.stringify([...done]));
        const usd = (tokens / 1e6) * pricePerMTok;
        process.stdout.write(
          `\r  ${filesDone}/${files.length} files  ${embedded.toLocaleString()} embedded  ` +
            `${reused.toLocaleString()} reused  ` +
            `${(tokens / 1e6).toFixed(2)}M tok  $${usd.toFixed(2)}  ` +
            `${((Date.now() - started) / 60000).toFixed(1)}m   `,
        );
      }
    }
  }

  await Bun.write(donePath, JSON.stringify([...done]));

  const usd = (tokens / 1e6) * pricePerMTok;
  console.log("\n");
  console.log(`files    : ${filesDone.toLocaleString()}`);
  console.log(`embedded : ${embedded.toLocaleString()}`);
  console.log(
    `reused   : ${reused.toLocaleString()} (vector already stored, text unchanged)`,
  );
  console.log(`tokens   : ${tokens.toLocaleString()}`);
  console.log(`spend    : $${usd.toFixed(2)} of $${maxUsd.toFixed(2)}`);
  console.log(`elapsed  : ${((Date.now() - started) / 60000).toFixed(1)}m`);
  if (stopped)
    console.log(
      `\nStopped on budget. Re-run with a higher --max-usd to continue.`,
    );
};

await main();
