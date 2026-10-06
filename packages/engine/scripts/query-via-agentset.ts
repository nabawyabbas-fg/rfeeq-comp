/**
 * Queries through agentset's production retrieval path: namespace row from the
 * database -> provider config -> queryVectorStore. Nothing here knows about
 * Qdrant or turath specifically.
 */
import { db } from "@agentset/db/client";

import {
  getNamespaceEmbeddingModel,
  getNamespaceVectorStore,
  queryVectorStore,
} from "../src/index";

const namespace = await db.namespace.findFirstOrThrow({
  where: { slug: "turath-aqida" },
});
console.log(`namespace: ${namespace.id} (${namespace.name})`);
console.log(`store    : ${(namespace.vectorStoreConfig as any)?.provider}`);
console.log(`model    : ${(namespace.embeddingConfig as any)?.model}\n`);

const [embeddingModel, vectorStore] = await Promise.all([
  getNamespaceEmbeddingModel(namespace, "query"),
  getNamespaceVectorStore(namespace),
]);

console.log(`supportsKeyword     : ${vectorStore.supportsKeyword()}`);
console.log(`supportsOrderedQuery: ${vectorStore.supportsOrderedQuery()}\n`);

for (const mode of ["semantic", "hybrid"] as const) {
  const { results } = await queryVectorStore({
    query: "ما حكم الاستغاثة بغير الله",
    embeddingModel,
    vectorStore,
    topK: 3,
    mode,
    includeMetadata: true,
  });

  console.log(`--- ${mode.toUpperCase()} via agentset (${results.length}) ---`);
  for (const r of results) {
    const m = r.metadata as any;
    console.log(`  ${r.score?.toFixed(3) ?? "-"}  ${m?.bookName} — ${m?.authorName}`);
    console.log(`         ج${m?.volume} ص${m?.printedPage} | ${(m?.headings ?? []).join(" > ")}`);
    console.log(`         ${m?.sourceUrl}`);
  }
  console.log();
}

process.exit(0);
