import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// `ba-stick-render` = wasm-bindgen output of engine/ba-stick-render
// (run `pnpm wasm` / engine/build-wasm.sh first).
export default defineConfig({
  base: "./",
  resolve: {
    alias: {
      "ba-stick-render": fileURLToPath(new URL("../../engine/ba-stick-render/pkg/ba_stick_render.js", import.meta.url)),
    },
  },
  server: { port: 5174, fs: { allow: ["../.."] } },
  build: { target: "es2022" },
});
