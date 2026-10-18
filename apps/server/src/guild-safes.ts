/**
 * Mark Safes and Guild Wallets from the Safe Protocol Kit.
 *
 * The address is predicted before the Safe exists. Deploying lands on that
 * same address. Opening a wallet does not change it. xDAI sent to the
 * predicted address is still there after deploy.
 *
 * A Mark Safe is deployed when that Mark comes online. The owner is the
 * operator key. The salt is the operator id. The operator key pays the gas.
 * The guild and the bond use this address.
 *
 * A Guild Wallet is predicted when the guild accepts the member. The owner
 * is the member's Ethereum account, or the character id when that id is
 * already an address. The salt is the guild id plus the character id. One
 * wallet per character per guild. It is deployed when the member opens it.
 * The member pays the gas.
 *
 * The Mark, the listing key, and the session key are not owners of a Guild
 * Wallet. A Listing Safe, a Mark Safe, and a Guild Wallet may be threshold
 * 1. That is the same theft risk as one key. The Admin Safe stays at a
 * threshold of at least 2.
 *
 * Joining stays free. This module does not invent a bond amount and does not
 * send a payout. Predict and deploy run on local anvil and on Gnosis chain
 * 100. The salt includes that chain id, so the same operator does not predict
 * one address on every chain. Chiado stays refused. The operator key pays
 * the Mark Safe gas. A second open sends no transaction.
 */
import Safe, { type ContractNetworksConfig } from "@safe-global/protocol-kit";
import { createPublicClient, getAddress, http, isAddress, keccak256, toBytes, type Chain, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry, gnosis } from "viem/chains";
import { PINNED_GNOSIS_LISTING_ADDRESS } from "./production-boot";

const ANVIL_CHAIN_ID = 31337n;
const GNOSIS_CHAIN_ID = 100n;
const SAFE_VERSION = "1.5.0" as const;

/** A Listing Safe may be threshold 1. That is the same theft risk as one key. */
export const LISTING_SAFE_THRESHOLD = 1;
/** A Mark Safe may be threshold 1. That is the same theft risk as one key. */
export const MARK_SAFE_THRESHOLD = 1;
/** A Guild Wallet may be threshold 1. That is the same theft risk as one key. */
export const GUILD_WALLET_THRESHOLD = 1;
/** The Admin Safe stays at a threshold of at least 2. */
export const ADMIN_SAFE_MIN_THRESHOLD = 2;

export type LocalSafeContracts = {
  safeSingletonAddress: `0x${string}`;
  safeProxyFactoryAddress: `0x${string}`;
  fallbackHandlerAddress: `0x${string}`;
  multiSendAddress: `0x${string}`;
  multiSendCallOnlyAddress: `0x${string}`;
};

export type PredictedSafeResult =
  | { ok: true; address: `0x${string}` }
  | { ok: false; error: string };

export type OpenedSafeResult =
  | { ok: true; address: `0x${string}`; payer: `0x${string}` | null; deployed: boolean }
  | { ok: false; error: string };

export type GuildWalletRecord = {
  guildId: string;
  characterId: string;
  owner: `0x${string}`;
  saltNonce: string;
  threshold: typeof GUILD_WALLET_THRESHOLD;
  address: `0x${string}` | null;
};

export type GuildWalletAccept = {
  /** The member's Ethereum account. Used when the character id is not an address. */
  memberAccount?: string;
  /** Operator key address. Not an owner of a Guild Wallet. */
  mark?: string | null;
  /** Listing key address. Not an owner of a Guild Wallet. */
  listing?: string | null;
  /** Session key address. Not an owner of a Guild Wallet. */
  session?: string | null;
  /** Local anvil RPC. With `contracts`, accept predicts the Safe address before it returns. */
  rpc?: string;
  /** Safe singleton and factory on that anvil. */
  contracts?: LocalSafeContracts;
};

type MarkRecord = {
  operatorId: string;
  owner: `0x${string}`;
  saltNonce: string;
  address: `0x${string}` | null;
  deployed: boolean;
};

type WalletRecord = {
  guildId: string;
  characterId: string;
  owner: `0x${string}`;
  saltNonce: string;
  threshold: typeof GUILD_WALLET_THRESHOLD;
  address: `0x${string}` | null;
  deployed: boolean;
};

const marks = new Map<string, MarkRecord>();
const wallets = new Map<string, WalletRecord>();

export function resetGuildSafesForTests(): void {
  marks.clear();
  wallets.clear();
}

/**
 * Admin Safe threshold stays at least 2. A lower number is refused.
 * This does not change the Admin Safe.
 */
export function keptAdminSafeThreshold(threshold: number): number | null {
  if (!Number.isInteger(threshold) || threshold < ADMIN_SAFE_MIN_THRESHOLD) return null;
  return threshold;
}

/** Salt nonce for a Mark Safe. The salt is the chain id plus the operator id. */
export function saltNonceForOperator(operatorId: string, chainId: bigint | number = ANVIL_CHAIN_ID): string | null {
  if (typeof operatorId !== "string") return null;
  const id = operatorId.trim();
  const chain = saltChainId(chainId);
  if (!id || !chain) return null;
  return BigInt(keccak256(toBytes(chain + "\0" + id))).toString(10);
}

/** Salt nonce for one Guild Wallet. The salt is the chain id, the guild id, and the character id. */
export function saltNonceForGuildWallet(
  guildId: string,
  characterId: string,
  chainId: bigint | number = ANVIL_CHAIN_ID,
): string | null {
  if (typeof guildId !== "string" || typeof characterId !== "string") return null;
  const guild = guildId.trim();
  const character = characterId.trim();
  const chain = saltChainId(chainId);
  if (!guild || !character || !chain) return null;
  return BigInt(keccak256(toBytes(chain + "\0" + guild + "\0" + character))).toString(10);
}

function saltChainId(chainId: bigint | number): string | null {
  try {
    const id = typeof chainId === "bigint" ? chainId : BigInt(chainId);
    if (id <= 0n) return null;
    return id.toString(10);
  } catch {
    return null;
  }
}

/** An Ethereum account. A character id string is an account only when it already is one. */
export function ethereumAccount(value: string | null | undefined): `0x${string}` | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!isAddress(trimmed)) return null;
  return getAddress(trimmed);
}

/**
 * Owner of a Guild Wallet. The member's Ethereum account wins. The character
 * id is the owner only when that string is already an Ethereum address.
 */
export function guildWalletOwner(characterId: string, memberAccount?: string | null): `0x${string}` | null {
  const member = ethereumAccount(memberAccount);
  if (member) return member;
  return ethereumAccount(characterId);
}

export function anvilContractNetworks(contracts: LocalSafeContracts): ContractNetworksConfig {
  return {
    [ANVIL_CHAIN_ID.toString()]: {
      safeSingletonAddress: contracts.safeSingletonAddress,
      safeProxyFactoryAddress: contracts.safeProxyFactoryAddress,
      fallbackHandlerAddress: contracts.fallbackHandlerAddress,
      multiSendAddress: contracts.multiSendAddress,
      multiSendCallOnlyAddress: contracts.multiSendCallOnlyAddress,
    },
  };
}

function walletKey(guildId: string, characterId: string): string {
  return guildId + "\0" + characterId;
}

function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function copyWallet(record: WalletRecord): GuildWalletRecord {
  return {
    guildId: record.guildId,
    characterId: record.characterId,
    owner: record.owner,
    saltNonce: record.saltNonce,
    threshold: GUILD_WALLET_THRESHOLD,
    address: record.address,
  };
}

function keyAddress(privateKey: string): `0x${string}` | null {
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) return null;
  try {
    return privateKeyToAccount(privateKey as Hex).address;
  } catch {
    return null;
  }
}

function localAnvilRpc(rpc: string): boolean {
  return /^https?:\/\/(127\.0\.0\.1|localhost):\d+\/?$/i.test(rpc.trim());
}

type SafeNetwork =
  | { kind: "anvil"; chainId: typeof ANVIL_CHAIN_ID; chain: Chain }
  | { kind: "gnosis"; chainId: typeof GNOSIS_CHAIN_ID; chain: Chain };

/** Anvil stays on loopback chain 31337. Gnosis is chain 100, local or remote. Every other chain is refused. */
async function resolveSafeChain(rpc: string): Promise<{ ok: true; network: SafeNetwork } | { ok: false; error: string }> {
  const url = rpc.trim();
  let chainId: bigint;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
    });
    const body = (await res.json()) as { result?: string };
    if (!body.result) return { ok: false, error: "chain id was not available" };
    chainId = BigInt(body.result);
  } catch {
    return { ok: false, error: "chain id was not available" };
  }
  if (localAnvilRpc(url) && chainId === ANVIL_CHAIN_ID) {
    return { ok: true, network: { kind: "anvil", chainId: ANVIL_CHAIN_ID, chain: foundry } };
  }
  if (chainId === GNOSIS_CHAIN_ID) {
    return { ok: true, network: { kind: "gnosis", chainId: GNOSIS_CHAIN_ID, chain: gnosis } };
  }
  if (!localAnvilRpc(url)) return { ok: false, error: "Safe deploy refuses a non-local RPC" };
  return { ok: false, error: "Safe deploy refuses chain " + chainId.toString() };
}

function contractsReady(contracts: LocalSafeContracts | undefined): boolean {
  if (!contracts) return false;
  return (
    !!ethereumAccount(contracts.safeSingletonAddress) &&
    !!ethereumAccount(contracts.safeProxyFactoryAddress) &&
    !!ethereumAccount(contracts.fallbackHandlerAddress) &&
    !!ethereumAccount(contracts.multiSendAddress) &&
    !!ethereumAccount(contracts.multiSendCallOnlyAddress)
  );
}

function refusedOwner(owner: `0x${string}`, addresses: Array<string | null | undefined>): boolean {
  for (const candidate of addresses) {
    const account = ethereumAccount(candidate);
    if (account && sameAddress(account, owner)) return true;
  }
  return false;
}

async function predictedKit(args: {
  rpc: string;
  signer: Hex;
  owner: `0x${string}`;
  saltNonce: string;
  threshold: number;
  network: SafeNetwork;
  contracts?: LocalSafeContracts;
}): Promise<Safe> {
  const anvil = args.network.kind === "anvil";
  return Safe.init({
    provider: args.rpc,
    signer: args.signer,
    isL1SafeSingleton: true,
    ...(anvil && args.contracts ? { contractNetworks: anvilContractNetworks(args.contracts) } : {}),
    predictedSafe: {
      safeAccountConfig: {
        owners: [args.owner],
        threshold: args.threshold,
        ...(anvil && args.contracts ? { fallbackHandler: args.contracts.fallbackHandlerAddress } : {}),
      },
      safeDeploymentConfig: {
        saltNonce: args.saltNonce,
        safeVersion: SAFE_VERSION,
      },
    },
  });
}

async function predictAddress(args: {
  rpc: string;
  signer: Hex;
  owner: `0x${string}`;
  saltNonce: string;
  threshold: number;
  network: SafeNetwork;
  contracts?: LocalSafeContracts;
}): Promise<`0x${string}`> {
  const kit = await predictedKit(args);
  return getAddress(await kit.getAddress());
}

async function deployPredicted(args: {
  rpc: string;
  signer: Hex;
  owner: `0x${string}`;
  saltNonce: string;
  threshold: number;
  network: SafeNetwork;
  contracts?: LocalSafeContracts;
}): Promise<OpenedSafeResult> {
  if (args.network.kind === "anvil" && !contractsReady(args.contracts)) {
    return { ok: false, error: "Safe contracts are not on this anvil" };
  }
  const kit = await predictedKit(args);
  const predicted = getAddress(await kit.getAddress());
  if (await kit.isSafeDeployed()) {
    return { ok: true, address: predicted, payer: null, deployed: false };
  }
  const deployment = await kit.createSafeDeploymentTransaction();
  const signer = await kit.getSafeProvider().getExternalSigner();
  if (!signer || !("sendTransaction" in signer)) {
    return { ok: false, error: "Safe deploy needs the paying key" };
  }
  const hash = await signer.sendTransaction({
    chain: args.network.chain,
    to: deployment.to as Hex,
    value: BigInt(deployment.value),
    data: deployment.data as Hex,
  });
  const receipt = await createPublicClient({ chain: args.network.chain, transport: http(args.rpc) }).waitForTransactionReceipt({
    hash,
  });
  if (receipt.status !== "success") return { ok: false, error: "Safe deploy failed" };
  const deployed = getAddress(await kit.getAddress());
  if (!sameAddress(deployed, predicted)) {
    return { ok: false, error: "Deployed Safe address did not match the prediction" };
  }
  return { ok: true, address: deployed, payer: getAddress(receipt.from), deployed: true };
}

/** Mark Safe address for this operator. Null until it is predicted. The posted bond wei is not this. */
export function markSafeForOperator(operatorId: string): `0x${string}` | null {
  if (typeof operatorId !== "string") return null;
  return marks.get(operatorId.trim())?.address ?? null;
}

/** Operator key that owns the Mark Safe. Null until that Mark is predicted. */
export function markOwnerForOperator(operatorId: string): `0x${string}` | null {
  if (typeof operatorId !== "string") return null;
  return marks.get(operatorId.trim())?.owner ?? null;
}

/**
 * Predict the Mark Safe. The owner is the operator key and the salt is the
 * operator id. This does not deploy and does not send a payout.
 */
export async function predictMarkSafe(args: {
  rpc: string;
  operatorId: string;
  operatorKey: string;
  contracts: LocalSafeContracts;
}): Promise<PredictedSafeResult> {
  try {
    const resolved = await resolveSafeChain(args.rpc);
    if (!resolved.ok) return resolved;
    if (resolved.network.kind === "anvil" && !contractsReady(args.contracts)) {
      return { ok: false, error: "Safe contracts are not on this anvil" };
    }
    if (typeof args.operatorId !== "string" || !args.operatorId.trim()) {
      return { ok: false, error: "Mark Safe needs an operator id" };
    }
    const operatorId = args.operatorId.trim();
    const owner = keyAddress(args.operatorKey);
    const saltNonce = saltNonceForOperator(operatorId, resolved.network.chainId);
    if (!owner || !saltNonce) return { ok: false, error: "Mark Safe owner is the operator key" };
    const existing = marks.get(operatorId);
    if (existing && !sameAddress(existing.owner, owner)) {
      return { ok: false, error: "Mark Safe owner is already the operator key" };
    }
    const address = await predictAddress({
      rpc: args.rpc.trim(),
      signer: args.operatorKey as Hex,
      owner,
      saltNonce,
      threshold: MARK_SAFE_THRESHOLD,
      network: resolved.network,
      contracts: args.contracts,
    });
    marks.set(operatorId, {
      operatorId,
      owner,
      saltNonce,
      address,
      deployed: existing?.deployed ?? false,
    });
    return { ok: true, address };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Mark Safe prediction failed" };
  }
}

/**
 * Deploy the Mark Safe when that Mark comes online. The operator key pays
 * the gas. The address matches the prediction. A second open does not
 * change it and does not send another transaction.
 */
export async function markComesOnline(args: {
  rpc: string;
  operatorId: string;
  operatorKey: string;
  contracts: LocalSafeContracts;
}): Promise<OpenedSafeResult> {
  try {
    const predicted = await predictMarkSafe(args);
    if (!predicted.ok) return predicted;
    const operatorId = args.operatorId.trim();
    const record = marks.get(operatorId);
    if (!record?.address) return { ok: false, error: "Mark Safe was not predicted" };
    const resolved = await resolveSafeChain(args.rpc);
    if (!resolved.ok) return resolved;
    const opened = await deployPredicted({
      rpc: args.rpc.trim(),
      signer: args.operatorKey as Hex,
      owner: record.owner,
      saltNonce: record.saltNonce,
      threshold: MARK_SAFE_THRESHOLD,
      network: resolved.network,
      contracts: args.contracts,
    });
    if (!opened.ok) return opened;
    if (!sameAddress(opened.address, predicted.address)) {
      return { ok: false, error: "Deployed Safe address did not match the prediction" };
    }
    if (opened.deployed && opened.payer && !sameAddress(opened.payer, record.owner)) {
      return { ok: false, error: "The operator key pays for the Mark Safe" };
    }
    record.address = opened.address;
    record.deployed = true;
    return opened;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Mark Safe deploy failed" };
  }
}

/**
 * Record the Guild Wallet when a join is accepted. When `rpc` and `contracts`
 * are set, Protocol Kit predicts the address before this returns. This does
 * not deploy and does not pay anyone.
 */
export async function noteAcceptedGuildWallet(args: {
  guildId: string;
  characterId: string;
  operatorId: string;
  memberAccount?: string | null;
  mark?: string | null;
  listing?: string | null;
  session?: string | null;
  rpc?: string;
  contracts?: LocalSafeContracts;
}): Promise<"recorded" | "skipped" | "failed"> {
  if (typeof args.guildId !== "string" || typeof args.characterId !== "string") return "skipped";
  const guildId = args.guildId.trim();
  const characterId = args.characterId.trim();
  if (!guildId || !characterId) return "skipped";
  const owner = guildWalletOwner(characterId, args.memberAccount);
  let network: SafeNetwork | null = null;
  if (args.rpc) {
    const resolved = await resolveSafeChain(args.rpc);
    if (!resolved.ok) return "failed";
    network = resolved.network;
  }
  const saltNonce = saltNonceForGuildWallet(guildId, characterId, network?.chainId ?? ANVIL_CHAIN_ID);
  if (!owner || !saltNonce) return "skipped";
  const operatorId = typeof args.operatorId === "string" ? args.operatorId.trim() : "";
  if (
    refusedOwner(owner, [
      args.mark,
      markOwnerForOperator(operatorId),
      PINNED_GNOSIS_LISTING_ADDRESS,
      args.listing,
      args.session,
    ])
  ) {
    return "skipped";
  }
  const key = walletKey(guildId, characterId);
  const existing = wallets.get(key);
  if (existing?.address) return "recorded";
  let address: `0x${string}` | null = existing?.address ?? null;
  if (network) {
    if (network.kind === "anvil" && !contractsReady(args.contracts)) return "failed";
    try {
      address = await predictAddress({
        rpc: args.rpc!.trim(),
        signer: owner,
        owner,
        saltNonce,
        threshold: GUILD_WALLET_THRESHOLD,
        network,
        contracts: args.contracts,
      });
    } catch {
      return "failed";
    }
  }
  wallets.set(key, {
    guildId,
    characterId,
    owner,
    saltNonce,
    threshold: GUILD_WALLET_THRESHOLD,
    address,
    deployed: existing?.deployed ?? false,
  });
  return "recorded";
}

/** The Guild Wallet recorded for this character in this guild. One per pair. */
export function guildWallet(guildId: string, characterId: string): GuildWalletRecord | null {
  if (typeof guildId !== "string" || typeof characterId !== "string") return null;
  const record = wallets.get(walletKey(guildId.trim(), characterId.trim()));
  return record ? copyWallet(record) : null;
}

/**
 * Predict the Guild Wallet recorded at accept. Opening it later does not
 * change this address.
 */
export async function predictGuildWallet(args: {
  rpc: string;
  guildId: string;
  characterId: string;
  contracts: LocalSafeContracts;
}): Promise<PredictedSafeResult> {
  try {
    const resolved = await resolveSafeChain(args.rpc);
    if (!resolved.ok) return resolved;
    const record = wallets.get(walletKey(args.guildId.trim(), args.characterId.trim()));
    if (!record) return { ok: false, error: "Guild Wallet is predicted when the guild accepts the member" };
    if (resolved.network.kind === "anvil" && !contractsReady(args.contracts)) {
      return { ok: false, error: "Safe contracts are not on this anvil" };
    }
    const address = await predictAddress({
      rpc: args.rpc.trim(),
      signer: record.owner,
      owner: record.owner,
      saltNonce: record.saltNonce,
      threshold: GUILD_WALLET_THRESHOLD,
      network: resolved.network,
      contracts: args.contracts,
    });
    record.address = address;
    return { ok: true, address };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Guild Wallet prediction failed" };
  }
}

/**
 * Deploy the Guild Wallet when the member opens it. The member pays the gas.
 * The address stays the one predicted at accept.
 */
export async function openGuildWallet(args: {
  rpc: string;
  guildId: string;
  characterId: string;
  memberKey: string;
  contracts: LocalSafeContracts;
}): Promise<OpenedSafeResult> {
  try {
    const record = wallets.get(walletKey(args.guildId.trim(), args.characterId.trim()));
    if (!record) return { ok: false, error: "Guild Wallet is predicted when the guild accepts the member" };
    const payer = keyAddress(args.memberKey);
    if (!payer || !sameAddress(payer, record.owner)) {
      return { ok: false, error: "The member pays for the Guild Wallet" };
    }
    const predicted = await predictGuildWallet({
      rpc: args.rpc,
      guildId: record.guildId,
      characterId: record.characterId,
      contracts: args.contracts,
    });
    if (!predicted.ok) return predicted;
    const resolved = await resolveSafeChain(args.rpc);
    if (!resolved.ok) return resolved;
    const opened = await deployPredicted({
      rpc: args.rpc.trim(),
      signer: args.memberKey as Hex,
      owner: record.owner,
      saltNonce: record.saltNonce,
      threshold: GUILD_WALLET_THRESHOLD,
      network: resolved.network,
      contracts: args.contracts,
    });
    if (!opened.ok) return opened;
    if (!sameAddress(opened.address, predicted.address)) {
      return { ok: false, error: "Deployed Safe address did not match the prediction" };
    }
    if (opened.deployed && opened.payer && !sameAddress(opened.payer, record.owner)) {
      return { ok: false, error: "The member pays for the Guild Wallet" };
    }
    record.address = opened.address;
    record.deployed = true;
    return opened;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Guild Wallet deploy failed" };
  }
}
