/**
 * Loads the harvested turath catalogue into CorpusBook / CorpusAuthor.
 *
 * Idempotent: re-running after a re-harvest updates titles and adds new works.
 * Nothing is deleted — a book that leaves the catalogue but still has chunks in
 * the vector store should stay resolvable.
 *
 *   bun run scripts/import-corpus-catalogue.ts [--catalogue /data/turath/catalogue.json]
 */
import { readFileSync } from "node:fs";

import { db } from "@agentset/db/client";
import { normalizeArabicName } from "@agentset/utils";

interface Catalogue {
  cats: Record<string, { id: number; name: string }>;
  authors: Record<string, { id: number; name: string; death?: number }>;
  books: Record<
    string,
    {
      id: number;
      name: string;
      author_id?: number;
      cat_id?: number;
      page_count?: number;
    }
  >;
}

const arg = (name: string, fallback: string) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : fallback;
};

const path = arg("catalogue", "/data/turath/catalogue.json");
const cat = JSON.parse(readFileSync(path, "utf8")) as Catalogue;
const cats = Object.fromEntries(
  Object.values(cat.cats).map((c) => [c.id, c.name]),
);

const authors = Object.values(cat.authors).map((a) => ({
  id: a.id,
  name: a.name,
  nameNormalized: normalizeArabicName(a.name),
  death: a.death ?? null,
}));

// Authors first: the books reference them.
await db.$transaction(
  authors.map((a) =>
    db.corpusAuthor.upsert({ where: { id: a.id }, create: a, update: a }),
  ),
);
console.log(`authors: ${authors.length.toLocaleString()}`);

const books = Object.values(cat.books).map((b) => ({
  id: b.id,
  title: b.name,
  titleNormalized: normalizeArabicName(b.name),
  // a book whose author is missing from the catalogue keeps its row
  authorId: b.author_id && cat.authors[String(b.author_id)] ? b.author_id : null,
  category: b.cat_id ? (cats[b.cat_id] ?? null) : null,
  pageCount: b.page_count ?? null,
}));

for (let i = 0; i < books.length; i += 500) {
  const batch = books.slice(i, i + 500);
  await db.$transaction(
    batch.map((b) =>
      db.corpusBook.upsert({ where: { id: b.id }, create: b, update: b }),
    ),
  );
  process.stdout.write(`\r  books: ${Math.min(i + 500, books.length)}/${books.length}`);
}
console.log(`\nbooks: ${books.length.toLocaleString()}`);
