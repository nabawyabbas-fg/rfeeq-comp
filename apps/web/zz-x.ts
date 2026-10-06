import * as t from "@/lib/rfeeq/sources/mcp/tafsir";
for (const c of await t.fetchAyahExtras(2, 25)) {
  console.log(`${c.metadata?.kind}  —  ${c.metadata?.title}`);
  console.log(`   ${c.text.slice(0, 120).replace(/\n/g, " / ")}…`);
}
