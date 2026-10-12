/**
 * Reown AppKit bootstrap — https://docs.reown.com/appkit/overview
 * createAppKit once at module scope (outside React components).
 * projectId = VITE_WALLETCONNECT_PROJECT_ID (Reown Dashboard).
 *
 * Do NOT use @walletconnect/ethereum-provider showQrModal for Connect — that is
 * a QR-only Web3Modal and is what produced the raw-QR UX.
 */
import { createAppKit, type AppKit } from "@reown/appkit/react";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import {
  anvil,
  gnosis,
  gnosisChiado,
  mainnet,
  type AppKitNetwork,
} from "@reown/appkit/networks";
import { anvilWalletConnectAllowed, defaultRpcUrl, walletConnectProjectId } from "./walletconnect";

function appKitNetworks(): [AppKitNetwork, ...AppKitNetwork[]] {
  const list: AppKitNetwork[] = [mainnet, gnosis, gnosisChiado];
  if (anvilWalletConnectAllowed()) list.push(anvil);
  return list as [AppKitNetwork, ...AppKitNetwork[]];
}

function defaultNetwork(): AppKitNetwork {
  const raw = import.meta.env.VITE_CHAIN_ID?.trim();
  const id = raw && /^\d+$/.test(raw) ? Number(raw) : 100;
  if (id === 1) return mainnet;
  if (id === 10200) return gnosisChiado;
  if (id === 31337 && anvilWalletConnectAllowed()) return anvil;
  return gnosis;
}

let kit: AppKit | null = null;
let initError: string | null = null;
let initialized = false;

/** Lazily create AppKit so a failed createAppKit does not break the whole bundle. */
export function ensureAppKit(): AppKit | null {
  if (initialized) return kit;
  initialized = true;
  const projectId = walletConnectProjectId();
  if (!projectId) return null;
  try {
    kit = createAppKit({
      adapters: [new EthersAdapter()],
      networks: appKitNetworks(),
      defaultNetwork: defaultNetwork(),
      projectId,
      metadata: {
        name: "Legend of KEK",
        description: "Bellgrave — Legend of KEK",
        url: typeof window !== "undefined" ? window.location.origin : "https://legendofkek.com",
        icons: ["https://legendofkek.com/favicon.ico"],
      },
      customRpcUrls: {
        [`eip155:${mainnet.id}`]: [{ url: defaultRpcUrl(1) }],
        [`eip155:${gnosis.id}`]: [{ url: defaultRpcUrl(100) }],
        [`eip155:${gnosisChiado.id}`]: [{ url: defaultRpcUrl(10200) }],
        ...(anvilWalletConnectAllowed()
          ? { [`eip155:${anvil.id}`]: [{ url: defaultRpcUrl(31337) }] }
          : {}),
      },
      features: {
        analytics: false,
        email: false,
        socials: false,
        swaps: false,
        onramp: false,
      },
      allWallets: "SHOW",
      themeMode: "dark",
    });
  } catch (err) {
    initError = err instanceof Error ? err.message : String(err);
    console.error("[bellgrave] createAppKit failed — Connect will not use raw WC QR:", initError);
    kit = null;
  }
  return kit;
}

/** Eager init when this module is imported from main.tsx. */
ensureAppKit();

export const appKit: AppKit | null = ensureAppKit();

export function appKitConfigured(): boolean {
  return ensureAppKit() != null;
}

export function appKitInitError(): string | null {
  ensureAppKit();
  return initError;
}
