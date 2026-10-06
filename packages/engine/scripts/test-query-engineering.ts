/** Baseline (raw query) vs engineered (planned, multi-facet) retrieval. */
import { createOpenAI } from "@ai-sdk/openai";
import { db } from "@agentset/db/client";

import { executePlan } from "../src/query-engineering/execute";
import { planSearches } from "../src/query-engineering/index";
import {
  getNamespaceEmbeddingModel,
  getNamespaceVectorStore,
  queryVectorStore,
} from "../src/index";

const openai = createOpenAI({ apiKey: process.env.EMBED_API_KEY! });
const planner = openai(process.env.PLANNER_MODEL ?? "gpt-5-mini");

const namespace = await db.namespace.findFirstOrThrow({
  where: { slug: "turath-aqida" },
});
const [embeddingModel, vectorStore] = await Promise.all([
  getNamespaceEmbeddingModel(namespace, "query"),
  getNamespaceVectorStore(namespace),
]);

const brief = (m: any) =>
  `${(m?.bookName ?? "?").slice(0, 38)} ج${m?.volume} ص${m?.printedPage}`;

for (const q of process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["Is seeking help from saints allowed in Islam?"]) {
  console.log(`\n${"█".repeat(76)}\nUSER: ${q}\n${"█".repeat(76)}`);

  console.log("\n### BASELINE — raw query, semantic ###");
  const base = await queryVectorStore({
    query: q,
    embeddingModel,
    vectorStore,
    topK: 5,
    mode: "semantic",
    includeMetadata: true,
    rerank: false,
  });
  base.results.forEach((r, i) =>
    console.log(`  ${i + 1}. ${r.score?.toFixed(3)}  ${brief(r.metadata)}`),
  );

  console.log("\n### QUERY ENGINEERING ###");
  const plan = await planSearches({ model: planner, query: q });
  console.log(`  language : ${plan.language}`);
  console.log(`  domains  : ${plan.domains.join(", ")}`);
  console.log(`  ruling?  : ${plan.isRulingQuestion}`);
  console.log(`  terms    : ${plan.classicalTerms.join(" · ")}`);
  console.log(`  searches :`);
  for (const s of plan.searches) {
    console.log(`    [${s.facet}/${s.mode}] ${s.query}`);
  }

  const { results } = await executePlan({
    plan,
    embeddingModel,
    vectorStore,
    topK: 5,
  });
  console.log("\n### ENGINEERED RESULTS ###");
  results.forEach((r, i) =>
    console.log(
      `  ${i + 1}. rrf=${r.fusedScore.toFixed(4)} [${r.facets.join(",")}]  ${brief(r.metadata)}`,
    ),
  );
}

process.exit(0);
