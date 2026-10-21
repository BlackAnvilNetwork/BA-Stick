import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import dns from "node:dns";
import path from "node:path";

dns.setDefaultResultOrder("ipv4first");

/** Same L-8 guard as apps/web: public networks need a WalletConnect project id. */
function assertWalletConnectProjectIdForPublicNetwork(env: Record<string, string | undefined>): void {
  const named = (env.VITE_NETWORK ?? "").trim().toLowerCase();
  const chain = (env.VITE_CHAIN_ID ?? "").trim();
  const publicNet = named === "gnosis" || named === "chiado" || chain === "100" || chain === "10200";
  if (!publicNet) return;
  if ((env.VITE_WALLETCONNECT_PROJECT_ID ?? "").trim().length >= 8) return;
  throw new Error("VITE_WALLETCONNECT_PROJECT_ID is required when VITE_NETWORK is gnosis/chiado (or chain 100/10200).");
}

// public/ holds symlinks to apps/web/public/{ui,icons,audio} (HUD chrome, icons, sfx). No sprites/textures.
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, __dirname, "");
  if (command === "build") assertWalletConnectProjectIdForPublicNetwork(env);
  return {
    base: "./",
    plugins: [react()],
    resolve: {
      alias: {
        "ba-stick-render": path.resolve(__dirname, "../../engine/ba-stick-render/pkg/ba_stick_render.js"),
        "@bellgrave/combat": path.resolve(__dirname, "../../packages/combat/src/index.ts"),
        "@bellgrave/config": path.resolve(__dirname, "../../packages/config/src/index.ts"),
        "@bellgrave/protocol": path.resolve(__dirname, "../../packages/protocol/src/index.ts"),
      },
    },
    server: { host: "::", port: 5174, strictPort: true, fs: { allow: ["../.."] } },
    build: { target: "es2022", chunkSizeWarningLimit: 6000 },
  };
});
