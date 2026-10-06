import { callMcpTool } from "@/lib/rfeeq/sources/mcp/client";
const r = await callMcpTool("tafsir-center", "get_qeraat_variants", { surah: 112, ayah: 4 });
const raw = r.structuredContent ?? JSON.parse(r.text ?? "{}");
console.log(JSON.stringify(raw).slice(0, 1200));
