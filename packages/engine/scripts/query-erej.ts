/**
 * Retrieval smoke test for the erej corpus.
 *
 * Deliberately resolves the namespace out of the database and goes through
 * `getNamespaceVectorStore`, rather than constructing a Qdrant client against
 * a hard-coded collection the way query-turath.ts does. That is the whole
 * point of the test: it proves the wiring the compare window actually uses —
 * namespace row -> vectorStoreConfig -> `as_${namespace.id}` — and not merely
 * that a collection with the right name exists.
 */
import { createOpenAI } from "@ai-sdk/openai";
import { embed } from "ai";

import { db } from "@agentset/db/client";

import { getNamespaceVectorStore } from "../src/vector-store/index";

const NAMESPACE_ID = process.argv[2] ?? "erej";

const namespace = await db.namespace.findUnique({
  where: { id: NAMESPACE_ID },
  select: { id: true, name: true, vectorStoreConfig: true, keywordEnabled: true },
});
if (!namespace) throw new Error(`no namespace row with id "${NAMESPACE_ID}"`);

console.log(`namespace : ${namespace.id} — ${namespace.name}`);
console.log(`collection: as_${namespace.id}`);
console.log(`keyword   : ${namespace.keywordEnabled ? "enabled" : "disabled"}`);

const store = await getNamespaceVectorStore(namespace);
const openai = createOpenAI({ apiKey: process.env.EMBED_API_KEY! });
const model = openai.textEmbeddingModel("text-embedding-3-large");

const cite = (m: Record<string, unknown> | undefined) =>
  !m
    ? "(no metadata)"
    : `${m.title}\n       ${m.categoryPath}\n       ${m.sourceUrl}`;

const run = async (query: string) => {
  console.log(`\n${"=".repeat(78)}\nQUERY: ${query}\n${"=".repeat(78)}`);
  const { embedding } = await embed({ model, value: query });

  for (const mode of ["semantic", "keyword", "hybrid"] as const) {
    const results = await store.query({
      topK: 2,
      includeMetadata: true,
      mode:
        mode === "semantic"
          ? { type: "semantic", vector: embedding }
          : mode === "keyword"
            ? { type: "keyword", text: query }
            : { type: "hybrid", vector: embedding, text: query },
    });
    console.log(`\n--- ${mode.toUpperCase()} (${results.length} hits) ---`);
    results.forEach((r, i) => {
      console.log(
        `  [${i + 1}] score=${r.score?.toFixed(3) ?? "-"}  ${cite(r.metadata)}`,
      );
    });
  }
};

await run("حكم التأمين الصحي");
await run("عمليات التجميل");
await run("زكاة الأسهم");
