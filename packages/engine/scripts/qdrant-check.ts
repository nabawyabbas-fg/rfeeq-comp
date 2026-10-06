import { Qdrant } from "./src/vector-store/qdrant/index";

const NS = "checkns" + Math.floor(Date.now() / 1000);
const dim = 8;
const vec = (seed: number) =>
  Array.from({ length: dim }, (_, i) => Math.sin(seed + i) / 2 + 0.5);

const mk = (id: string, text: string, seed: number, page: number) => ({
  documentId: "doc1",
  chunk: { id, text, metadata: { page_number: page, sequence_number: page } },
  embedding: vec(seed),
});

const store = new Qdrant({ url: "http://localhost:6333", namespaceId: NS });

// Text deliberately carries diacritics; queries below will not.
await store.upsert({
  chunks: [
    mk("c1", "بَابُ الطَّهَارَةِ وَأَحْكَامِهَا فِي الْفِقْهِ", 1, 1),
    mk("c2", "كِتَابُ الصَّلَاةِ وَمَوَاقِيتِهَا", 2, 2),
    mk("c3", "ذِكْرُ ابْنِ تَيْمِيَّةَ فِي مَسْأَلَةِ الْعَقِيدَةِ", 3, 3),
  ] as never,
});

const ids = (r: { id: string }[]) => r.map((x) => x.id).join(",");

const semantic = await store.query({
  topK: 3,
  mode: { type: "semantic", vector: vec(3) },
  includeMetadata: true,
});
console.log("semantic (nearest to c3) :", ids(semantic), "| top score:", semantic[0]?.score?.toFixed(3));
console.log("  metadata preserved     :", JSON.stringify(semantic[0]?.metadata));

// Undiacriticised query — must still match the diacriticised source.
const keyword = await store.query({
  topK: 3,
  mode: { type: "keyword", text: "الطهاره" },
});
console.log("keyword 'الطهاره' -> c1  :", ids(keyword) || "(none)");

const keyword2 = await store.query({
  topK: 3,
  mode: { type: "keyword", text: "ابن تيمية" },
});
console.log("keyword 'ابن تيمية' -> c3:", ids(keyword2) || "(none)");

const hybrid = await store.query({
  topK: 3,
  mode: { type: "hybrid", vector: vec(1), text: "العقيده" },
});
console.log("hybrid (vec~c1 + kw c3)  :", ids(hybrid));

const filtered = await store.query({
  topK: 5,
  mode: { type: "semantic", vector: vec(1) },
  filter: { page_number: { $gte: 2 } },
});
console.log("filter page_number>=2    :", ids(filtered));

const ordered = await store.queryOrdered({
  topK: 5,
  filter: {},
  orderBy: { attribute: "page_number", direction: "desc" },
  includeMetadata: true,
});
console.log("ordered by page desc     :", ids(ordered));

// Tenant isolation: a scoped store must not see the unscoped rows.
const tenant = new Qdrant({ url: "http://localhost:6333", namespaceId: NS, tenantId: "acme" });
await tenant.upsert({ chunks: [mk("t1", "نَصٌّ خَاصٌّ بِالْمُسْتَأْجِرِ", 9, 1)] as never });
const tenantView = await tenant.query({ topK: 10, mode: { type: "semantic", vector: vec(1) } });
const globalView = await store.query({ topK: 10, mode: { type: "semantic", vector: vec(1) } });
console.log("tenant sees              :", ids(tenantView));
console.log("untenanted sees          :", ids(globalView));

const del = await store.deleteByIds(["doc1#c2"]);
const after = await store.query({ topK: 10, mode: { type: "semantic", vector: vec(1) } });
console.log("after delete c2          :", ids(after), "| deleted:", del.deleted);

await store.deleteNamespace();
console.log("dropped collection       : ok");
