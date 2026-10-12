import { execFile } from "node:child_process";
import { renameSync, writeFileSync } from "node:fs";

/** Accepted on the local anvil only. Not a mainnet ruleset. Bumped with ChainFill payment refs. */
export const LOCAL_RULESET_HASH = "0xb7e4d1c9a8f6520e3d7c6b5a49382716f0e1d2c3b4a5968778695a4b3c2d1e0f";

/**
 * sha256 of the checked-in engine bundle (contracts/lok-log/engine/pkg/lok_engine.wasm) that
 * checkpoints signed under LOCAL_RULESET_HASH are computed with. LOCAL_RULESET_HASH is an opaque id
 * registered on the local anvil; it is not derived from the wasm, so this pin is the binding.
 * lok-ruleset-pin.test.ts fails when the checked-in wasm drifts from it. When the engine changes on
 * purpose: rebuild the wasm, run contracts/lok-log/engine/scripts/check-wasm-pin.mjs, update this pin,
 * and on any non-local network propose a new ruleset hash for the new bundle.
 */
export const LOCAL_RULESET_WASM_SHA256 = "5d54853ebfc6a17eb3306045749c4b92e2ac8540b645f4a911ddc42e65e9377b";

export const LOCAL_ANVIL_CHAIN_ID = 31337n;

export type CastResult = { stdout: string; stderr: string };
export type CastFn = (args: string[]) => Promise<CastResult>;

export type VaultErr = { ok: false; error: string; uncertain?: boolean; id?: string };

type Env = {
  rpc: string;
  nft: string;
  factory: string;
  rulesets: string;
  ownerKey: string;
  proposerKey: string;
  castBin: string;
};

function envOf(env: NodeJS.ProcessEnv): Env {
  const pick = (key: string) => env[key]?.trim() ?? "";
  return {
    rpc: pick("LOK_CHAIN_RPC"),
    nft: pick("LOK_NFT"),
    factory: pick("LOK_FACTORY"),
    rulesets: pick("LOK_RULESETS"),
    ownerKey: pick("LOK_OWNER_KEY"),
    proposerKey: pick("LOK_PROPOSER_KEY"),
    castBin: pick("LOK_CAST") || "cast",
  };
}

export function spawnCast(bin: string): CastFn {
  return (args) =>
    new Promise((resolve, reject) => {
      execFile(bin, args, { timeout: 90_000, windowsHide: true, maxBuffer: 4_000_000 }, (err, stdout, stderr) => {
        if (err) {
          const wrapped = new Error(String(stderr || err.message || "cast failed"));
          reject(wrapped);
          return;
        }
        resolve({ stdout: String(stdout), stderr: String(stderr) });
      });
    });
}

function word(stdout: string): string {
  return stdout.trim().split(/\s+/)[0] ?? "";
}

function redact(text: string, secrets: string[]): string {
  let out = text;
  for (const secret of secrets) {
    if (secret.length >= 8) out = out.split(secret).join("[redacted]");
  }
  return out.replace(/\s+/g, " ").trim().slice(0, 280);
}

async function call(cast: CastFn, rpc: string, to: string, sig: string, args: string[] = []): Promise<string> {
  const res = await cast(["call", to, sig, ...args, "--rpc-url", rpc]);
  return word(res.stdout);
}

function sendArgs(to: string, sig: string, args: string[], rpc: string, key: string, value?: string): string[] {
  const out = ["send", to, sig, ...args, "--rpc-url", rpc, "--private-key", key];
  if (value) out.push("--value", value);
  return out;
}

export function writeTextAtomic(path: string, text: string): void {
  const tmp = path + ".tmp";
  writeFileSync(tmp, text);
  renameSync(tmp, path);
}

function isAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

async function ownerAddress(cast: CastFn, key: string): Promise<string> {
  const res = await cast(["wallet", "address", "--private-key", key]);
  return word(res.stdout);
}

export async function linkCharacterNft(
  tokenId: string,
  job: number,
  playerWallet?: string,
  envIn: NodeJS.ProcessEnv = process.env,
  cast: CastFn = spawnCast(envOf(envIn).castBin),
): Promise<{ ok: true; tokenId: string } | VaultErr> {
  const env = envOf(envIn);
  if (!env.rpc || !env.factory || !env.nft || !env.ownerKey) {
    return { ok: false, error: "Character mint is not configured. The log identity was still created." };
  }
  if (!Number.isInteger(job) || job < 0 || job > 255) return { ok: false, error: "That job cannot be minted." };
  const player = playerWallet && isAddress(playerWallet) ? playerWallet.toLowerCase() : "";
  try {
    const chainId = word((await cast(["chain-id", "--rpc-url", env.rpc])).stdout);
    if (BigInt(chainId) !== LOCAL_ANVIL_CHAIN_ID) {
      return { ok: false, error: "Character mint is only submitted on local chain 31337." };
    }
    const owner = (await ownerAddress(cast, env.ownerKey)).toLowerCase();
    const dest = player && player !== owner ? player : owner;
    const give = async (held: string) => {
      if (held === dest) return;
      if (held !== owner) throw new Error("already minted");
      if (dest !== owner) {
        await cast(sendArgs(env.nft, "transferFrom(address,address,uint256)", [owner, dest, tokenId], env.rpc, env.ownerKey));
      }
    };
    let exists = false;
    try {
      const held = (await call(cast, env.rpc, env.nft, "ownerOf(uint256)(address)", [tokenId])).toLowerCase();
      exists = true;
      await give(held);
      return { ok: true, tokenId };
    } catch (err) {
      if (exists) {
        const message = String(err).includes("already minted")
          ? "NFT " + tokenId + " is already minted to someone else. No second mint was sent."
          : "Character NFT could not be moved to the player wallet. " + redact(String(err), [env.ownerKey]);
        return { ok: false, error: message };
      }
    }
    const last = BigInt(await call(cast, env.rpc, env.nft, "nextTokenId()(uint256)"));
    if (last + 1n !== BigInt(tokenId)) {
      return {
        ok: false,
        error: "Refused to mint NFT " + tokenId + " because the checkpoint next id is " + String(last + 1n) + ".",
      };
    }
    const fee = await call(cast, env.rpc, env.factory, "mintFee()(uint256)");
    await cast(sendArgs(env.factory, "createCharacter(uint8)", [String(job)], env.rpc, env.ownerKey, fee));
    await give(owner);
    return { ok: true, tokenId };
  } catch (err) {
    return { ok: false, error: "Character NFT was not minted. " + redact(String(err), [env.ownerKey]) };
  }
}

export async function ensureLocalRuleset(
  envIn: NodeJS.ProcessEnv = process.env,
  cast: CastFn = spawnCast(envOf(envIn).castBin),
): Promise<void> {
  const env = envOf(envIn);
  if (!env.rpc || !env.rulesets || !env.proposerKey) return;
  try {
    const accepted = await call(cast, env.rpc, env.rulesets, "isAccepted(bytes32)(bool)", [LOCAL_RULESET_HASH]);
    if (accepted === "true") return;
    const delay = await call(cast, env.rpc, env.rulesets, "minDelay()(uint64)");
    await cast(
      sendArgs(env.rulesets, "propose(bytes32,uint64,string)", [LOCAL_RULESET_HASH, delay, "local"], env.rpc, env.proposerKey),
    );
    console.log("[bellgrave] proposed local ruleset. It is not accepted until the registry delay elapses.");
  } catch (err) {
    console.error("[bellgrave] ruleset setup failed: " + redact(String(err), [env.proposerKey, env.ownerKey]));
  }
}
