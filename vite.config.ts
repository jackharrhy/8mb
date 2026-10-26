import { defineConfig } from "vite";
export default defineConfig({
  base: "/8mb/",
  worker: { format: "es" },
  build: { target: "es2022" },
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});
