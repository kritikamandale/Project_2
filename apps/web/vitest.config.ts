import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    exclude: ["**/node_modules/**", "**/dist/**", "**/tests/e2e/**"],
    alias: {
      "@": path.resolve(__dirname, "./"),
      "@skin-analysis/shared-types": path.resolve(__dirname, "../../packages/shared-types/src/index.ts"),
    },
  },
});
