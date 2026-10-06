/**
 * Prints the system prompt a corpus actually receives.
 *
 * The prompts are composed at request time from shared and corpus-bound
 * blocks, so reading corpus-prompts.ts shows the parts but never the finished
 * text. This prints what the model is really sent.
 *
 *   bun run scripts/show-corpus-prompts.ts            # list the variants
 *   bun run scripts/show-corpus-prompts.ts fatawa     # one namespace, in full
 *   bun run scripts/show-corpus-prompts.ts all        # every corpus pooled
 *   bun run scripts/show-corpus-prompts.ts --out ./p  # write each to a file
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { db } from "@agentset/db/client";

import { corpusPromptFor } from "../src/lib/agentic-search/corpus-prompts";
import { resolveSystemPrompt } from "../src/lib/agentic-search/prompts";

/**
 * What the model is actually sent. The pipeline runs every prompt through
 * resolveSystemPrompt, which appends the platform tool-and-citation contract to
 * anything that is not a known default — and a composed corpus prompt never is.
 * Printing corpusPromptFor alone showed a prompt that is never used verbatim,
 * and hid the block that carries the citation format.
 *
 * The pipeline also appends a per-request language directive, which depends on
 * the question and so cannot appear here.
 */
const resolved = (corpora: Parameters<typeof corpusPromptFor>[0]) =>
  resolveSystemPrompt(corpusPromptFor(corpora));

const args: string[] = process.argv.slice(2);
const outFlag = args.indexOf("--out");
const outDir = outFlag >= 0 ? args[outFlag + 1] : null;
const target = args.find((a) => !a.startsWith("--") && a !== outDir);

const namespaces = await db.namespace.findMany({
  select: { id: true, name: true, slug: true, corpusProfile: true },
  orderBy: { createdAt: "asc" },
});

const variants: { key: string; label: string; corpora: typeof namespaces }[] = [
  ...namespaces.map((n) => ({
    key: n.slug,
    label: `${n.name}  [${n.corpusProfile}]`,
    corpora: [n],
  })),
  { key: "all", label: "All corpora pooled", corpora: namespaces },
];

if (outDir) {
  mkdirSync(outDir, { recursive: true });
  for (const v of variants) {
    const path = join(outDir, `${v.key}.txt`);
    writeFileSync(path, resolved(v.corpora));
    console.log(`${path}  (${resolved(v.corpora).length} chars)`);
  }
} else if (!target) {
  console.log("Corpus prompt variants:\n");
  for (const v of variants) {
    const p = resolved(v.corpora);
    console.log(
      `  ${v.key.padEnd(14)} ${String(p.length).padStart(5)} chars  ${v.label}`,
    );
  }
  console.log("\nPass a slug (or `all`) to print one in full.");
} else {
  const v = variants.find(
    (x) => x.key === target || x.corpora[0]?.id === target,
  );
  if (!v) {
    console.error(
      `no variant "${target}". Try: ${variants.map((x) => x.key).join(", ")}`,
    );
    process.exit(1);
  }
  console.log(resolved(v.corpora));
}
