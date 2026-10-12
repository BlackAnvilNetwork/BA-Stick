/**
 * Fill blank LOK_* address/RPC env from deployments/*.json when targeting
 * Gnosis (100) or Chiado (10200). Never copies MockItems / MockKEK.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { envSettlementChainId } from "./settlement-chain";

const here = dirname(fileURLToPath(import.meta.url));

type DeployFile = {
  chainId?: number;
  contracts?: Record<string, string>;
  rpcUrl?: string;
};

function defaultDeployPath(chainId: number): string {
  if (chainId === 100) return join(here, "../../../deployments/gnosis.json");
  if (chainId === 10200) return join(here, "../../../deployments/chiado.json");
  return "";
}

function defaultPublicRpc(chainId: number): string {
  if (chainId === 100) return "https://rpc.gnosischain.com";
  if (chainId === 10200) return "https://rpc.chiado.gnosis.gateway.fm";
  return "";
}

function fill(env: NodeJS.ProcessEnv, key: string, value: string | undefined): void {
  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value)) return;
  if (env[key] != null && env[key] !== "") return;
  env[key] = value;
}

/**
 * When LOK_CHAIN_ID is 100/10200, load contract addresses from the deploy JSON
 * into empty LOK_NFT / LOK_FACTORY / LOK_AH_ESCROW / LOK_CHECKPOINT / LOK_RULESETS.
 * Skips MockItems/MockKEK. Optional LOK_DEPLOY_JSON overrides the path.
 * Local 31337 is untouched (no file load).
 */
export function applySettlementDeployFile(env: NodeJS.ProcessEnv = process.env): void {
  const chainId = envSettlementChainId(env);
  if (chainId !== 100 && chainId !== 10200) return;

  const path = env.LOK_DEPLOY_JSON?.trim() || defaultDeployPath(chainId);
  if (!path || !existsSync(path)) {
    // Still fill public RPC defaults when addresses are set manually.
    if (!env.LOK_CHAIN_RPC?.trim()) {
      const rpc = defaultPublicRpc(chainId);
      if (rpc) env.LOK_CHAIN_RPC = rpc;
    }
    if (!env.LOK_PUBLIC_RPC?.trim() && env.LOK_CHAIN_RPC?.trim()) {
      env.LOK_PUBLIC_RPC = env.LOK_CHAIN_RPC;
    }
    return;
  }

  let parsed: DeployFile;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8")) as DeployFile;
  } catch (err) {
    console.warn(
      "[bellgrave] failed to parse deploy file " + path + ":",
      err instanceof Error ? err.message : err,
    );
    return;
  }

  if (parsed.chainId != null && parsed.chainId !== chainId) {
    console.warn(
      "[bellgrave] deploy file chainId=" +
        parsed.chainId +
        " != LOK_CHAIN_ID=" +
        chainId +
        "; skipping address fill",
    );
    return;
  }

  const c = parsed.contracts ?? {};
  fill(env, "LOK_NFT", c.CharacterNFT);
  fill(env, "LOK_FACTORY", c.CharacterFactory);
  fill(env, "LOK_AH_ESCROW", c.AhEscrow);
  fill(env, "LOK_CHECKPOINT", c.CharacterCheckpoint);
  fill(env, "LOK_RULESETS", c.RulesetRegistry);
  // Real Items only — never wire dry-run MockItems.
  if (c.Items) fill(env, "LOK_ITEMS", c.Items);

  if (!env.LOK_CHAIN_RPC?.trim()) {
    const rpc = parsed.rpcUrl?.trim() || defaultPublicRpc(chainId);
    if (rpc) env.LOK_CHAIN_RPC = rpc;
  }
  if (!env.LOK_PUBLIC_RPC?.trim() && env.LOK_CHAIN_RPC?.trim()) {
    env.LOK_PUBLIC_RPC = env.LOK_CHAIN_RPC;
  }

  console.log(
    "[bellgrave] settlement deploy file " +
      path +
      " chain=" +
      chainId +
      " nft=" +
      (env.LOK_NFT ?? "") +
      " escrow=" +
      (env.LOK_AH_ESCROW ?? ""),
  );
}
