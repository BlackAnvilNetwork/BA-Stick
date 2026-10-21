import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import dns from "node:dns";
import path from "node:path";

// Prefer 127.0.0.1 when tools resolve "localhost" (Node 17+ defaults to ::1 first).
dns.setDefaultResultOrder("ipv4first");

/** Mirror of burner-identity.assertWalletConnectProjectIdForPublicNetwork (keep vite.config free of src imports). */
function assertWalletConnectProjectIdForPublicNetwork(env: Record<string, string | undefined>): void {
  const named = (env.VITE_NETWORK ?? "").trim().toLowerCase();
  const chain = (env.VITE_CHAIN_ID ?? "").trim();
  const publicNet =
    named === "gnosis" || named === "chiado" || chain === "100" || chain === "10200";
  if (!publicNet) return;
  const id = (env.VITE_WALLETCONNECT_PROJECT_ID ?? "").trim();
  if (id.length >= 8) return;
  throw new Error(
    "VITE_WALLETCONNECT_PROJECT_ID is required when VITE_NETWORK is gnosis/chiado " +
      "(or VITE_CHAIN_ID is 100/10200). Get a project id from https://dashboard.reown.com",
  );
}

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, __dirname, "");
  // Fail production builds that would silently fall back to the burner on Gnosis/Chiado (L-8).
  if (command === "build") {
    assertWalletConnectProjectIdForPublicNetwork({
      VITE_NETWORK: env.VITE_NETWORK,
      VITE_CHAIN_ID: env.VITE_CHAIN_ID,
      VITE_WALLETCONNECT_PROJECT_ID: env.VITE_WALLETCONNECT_PROJECT_ID,
    });
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@bellgrave/combat": path.resolve(__dirname, "../../packages/combat/src/index.ts"),
        "@bellgrave/config": path.resolve(__dirname, "../../packages/config/src/index.ts"),
        "@bellgrave/protocol": path.resolve(__dirname, "../../packages/protocol/src/index.ts"),
      },
    },
    server: {
      // Dual-stack (::) so both http://localhost:5173 and http://127.0.0.1:5173 work.
      // Rabby site permissions are origin-scoped — pick one host and stick to it.
      // Fail loud if 5173 is taken — silent 5174+ used to break WS auth (server allowlist).
      host: "::",
      port: 5173,
      strictPort: true,
    },
  };
});
