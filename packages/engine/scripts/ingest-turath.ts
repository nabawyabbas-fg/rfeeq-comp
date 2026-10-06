/**
 * Embeds pre-chunked turath text into Qdrant through the real engine adapter.
 *
 * Chunking is deliberately NOT done here — `turath-chunker/run.py` produces the
 * chunks using agentset's own chunker, so boundaries match what the production
 * partitioner will emit. This script only embeds and upserts.
 *
 *   bun run scripts/ingest-turath.ts --model=text-embedding-3-large --max-usd=15
 */
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { createOpenAI } from "@ai-sdk/openai";
import { embedMany } from "ai";

import { Qdrant } from "../src/vector-store/qdrant/index";

const CHUNK_DIR = process.env.TURATH_CHUNKS ?? "/data/turath/chunks";
const QDRANT_URL = process.env.QDRANT_URL ?? "http://localhost:6333";

/** USD per 1M input tokens, as published for the embeddings endpoint. */
const PRICE_PER_MTOK: Record<string, number> = {
  "text-embedding-3-small": 0.02,
  "text-embedding-3-large": 0.13,
};

interface Chunk {
  id: string;
  text: string;
  metadata: Record<string, string | number | string[]>;
}

const arg = (name: string, fallback?: string) => {
  const hit = Bun.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : fallback;
};

const main = async () => {
  const apiKey = process.env.EMBED_API_KEY;
  if (!apiKey) throw new Error("EMBED_API_KEY is required");

  const modelName = arg("model", "text-embedding-3-small")!;
  const namespaceId = arg("namespace", "turath-aqida")!;
  const batchSize = Number(arg("batch", "96"));

  // Hard ceiling. Embedding is billed per token and this corpus is large enough
  // that an unbounded run is a real financial risk, so the budget is enforced
  // against reported usage rather than an estimate, and checked every batch.
  const maxUsd = Number(arg("max-usd", "15"));
  // A batch can be bounded by books as well as by spend, so a run can be sized
  // to something observable rather than only to a budget.
  const maxBooks = arg("max-books") ? Number(arg("max-books")) : Infinity;
  const pricePerMTok = PRICE_PER_MTOK[modelName];
  if (pricePerMTok === undefined) {
    throw new Error(`Unknown price for model ${modelName}; refusing to run`);
  }
  const maxTokens = (maxUsd / pricePerMTok) * 1_000_000;

  const openai = createOpenAI({
    apiKey,
    ...(process.env.EMBED_BASE_URL ? { baseURL: process.env.EMBED_BASE_URL } : {}),
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
  console.log(`budget    : $${maxUsd.toFixed(2)} → ${(maxTokens / 1e6).toFixed(1)}M tokens`);
  if (Number.isFinite(maxBooks)) console.log(`batch     : max ${maxBooks} books`);
  console.log(`chunks in : ${CHUNK_DIR} (${files.length} books, ${done.size} already done)`);
  console.log(`qdrant    : ${QDRANT_URL} ns=${namespaceId}\n`);

  let tokens = 0;
  let embedded = 0;
  let books = 0;
  let stopped = false;
  const started = Date.now();

  for (const file of files) {
    if (stopped) break;
    if (books >= maxBooks) {
      console.log(`\n\nBATCH LIMIT — ${maxBooks} books reached`);
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

      const batch = chunks.slice(i, i + batchSize);
      const result = await embedMany({
        model,
        values: batch.map((c) => c.text),
      });

      tokens += result.usage?.tokens ?? 0;
      embedded += batch.length;

      await store.upsert({
        chunks: batch.map((chunk, j) => ({
          documentId: `turath-${chunk.metadata.bookId}`,
          chunk: { id: chunk.id, text: chunk.text, metadata: chunk.metadata },
          embedding: result.embeddings[j]!,
        })) as never,
      });
    }

    if (!stopped) {
      done.add(file);
      books++;
      if (books % 5 === 0) {
        await Bun.write(donePath, JSON.stringify([...done]));
        const usd = (tokens / 1e6) * pricePerMTok;
        process.stdout.write(
          `\r  ${books}/${files.length} books  ${embedded.toLocaleString()} chunks  ` +
            `${(tokens / 1e6).toFixed(2)}M tok  $${usd.toFixed(2)}  ` +
            `${((Date.now() - started) / 60000).toFixed(1)}m   `,
        );
      }
    }
  }

  await Bun.write(donePath, JSON.stringify([...done]));

  const usd = (tokens / 1e6) * pricePerMTok;
  console.log("\n");
  console.log(`books    : ${books.toLocaleString()}`);
  console.log(`chunks   : ${embedded.toLocaleString()}`);
  console.log(`tokens   : ${tokens.toLocaleString()}`);
  console.log(`spend    : $${usd.toFixed(2)} of $${maxUsd.toFixed(2)}`);
  console.log(`elapsed  : ${((Date.now() - started) / 60000).toFixed(1)}m`);
  if (stopped) console.log(`\nStopped on budget. Re-run with a higher --max-usd to continue.`);
};

await main();
