/**
 * Reown AppKit bootstrap — matches https://docs.reown.com/appkit/overview
 * and the React + Ethers install guide: call createAppKit once at module scope
 * (outside React components) so the pre-built modal UI is available.
 *
 * projectId = VITE_WALLETCONNECT_PROJECT_ID from https://dashboard.reown.com
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

const projectId = walletConnectProjectId();

/** Singleton from createAppKit, or null when project id is unset. */
export const appKit: AppKit | null = projectId
  ? createAppKit({
      adapters: [new EthersAdapter()],
      networks: appKitNetworks(),
      defaultNetwork: defaultNetwork(),
      projectId,
      metadata: {
        name: "Legend of KEK",
        description: "Bellgrave — Legend of KEK",
        // Verify API: must match the page origin (localhost in preview).
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
    })
  : null;

export function appKitConfigured(): boolean {
  return appKit != null;
}
