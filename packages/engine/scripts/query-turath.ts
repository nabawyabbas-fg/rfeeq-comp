/** Retrieval smoke test against the embedded turath index. */
import { createOpenAI } from "@ai-sdk/openai";
import { embed } from "ai";

import { Qdrant } from "../src/vector-store/qdrant/index";

const openai = createOpenAI({ apiKey: process.env.EMBED_API_KEY! });
const model = openai.textEmbeddingModel("text-embedding-3-large");
const store = new Qdrant({
  url: "http://localhost:6333",
  namespaceId: "turath-aqida",
});

const cite = (m: Record<string, unknown> | undefined) => {
  if (!m) return "(no metadata)";
  const vol = m.volume ? `ج${m.volume} ` : "";
  const pg = m.printedPage ? `ص${m.printedPage}` : "";
  const heads = Array.isArray(m.headings) ? m.headings.join(" > ") : "";
  return `${m.bookName} — ${m.authorName}\n       ${vol}${pg}  |  ${heads || "(no breadcrumb)"}\n       ${m.sourceUrl}`;
};

const run = async (query: string, modes: ("semantic" | "keyword" | "hybrid")[]) => {
  console.log(`\n${"=".repeat(78)}\nQUERY: ${query}\n${"=".repeat(78)}`);
  const { embedding } = await embed({ model, value: query });

  for (const mode of modes) {
    const results = await store.query({
      topK: 3,
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
      console.log(`  [${i + 1}] score=${r.score?.toFixed(3) ?? "-"}  ${cite(r.metadata)}`);
      console.log(`       "${r.text.replace(/\n/g, " ").slice(0, 130)}..."`);
    });
  }
};

const all = ["semantic", "keyword", "hybrid"] as const;
await run("ما حكم الاستغاثة بغير الله", [...all]);
await run("نواقض الإسلام", [...all]);
await run("الاستغاثه بغير الله", ["keyword"]); // undiacriticised + ة→ه
await run("ابن تيمية", ["keyword"]);
