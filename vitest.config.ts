import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
      "server-only": resolve(import.meta.dirname, "./tests/stubs/server-only.ts"),
    },
  },
});
