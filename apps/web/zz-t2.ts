import { callMcpTool } from "@/lib/rfeeq/sources/mcp/client";
const r = await callMcpTool("tafsir-center", "fetch_tafsir", {
  surah: 112, ayah: 1, sources: ["moyassar", "mukhtasar_ar"],
});
const raw = r.structuredContent ?? JSON.parse(r.text ?? "{}");
const list = (raw as { tafsirs?: { source?: string; available?: boolean; text?: string }[] }).tafsirs ?? [];
console.log("asked for 2, got", list.length);
for (const t of list) console.log(`  ${t.source}  available=${t.available}  len=${(t.text ?? "").length}`);
