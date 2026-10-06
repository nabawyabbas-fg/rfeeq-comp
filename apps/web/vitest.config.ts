import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  /*
   * The automatic JSX runtime, so a component can be rendered in a test.
   *
   * Needed to assert the answer templates: whether a section renders folded,
   * and whether a verse comes from the retrieved chunk rather than from
   * anything the model wrote, are claims about markup — and the only honest way
   * to check markup is to produce it.
   */
  esbuild: { jsx: "automatic", jsxImportSource: "react" },
  test: {
    environment: "node",
    include: ["test/**/*.test.{ts,tsx}"],
  },
});
