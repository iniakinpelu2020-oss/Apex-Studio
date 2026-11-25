import { defineConfig } from "vite";

export default defineConfig({
  // Static app: index.html is the entry point.
  // VITE_* environment variables are inlined at build time.
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
