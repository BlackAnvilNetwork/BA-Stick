/**
 * Player-paid CharacterFactory mint (native settlement fee — same unit as AhEscrow / EEZ).
 * Prefer createCharacterFor when the factory supports it and a suggested id is known.
 * Validates the character name before paying; can reuse an already-paid unbound NFT (M-C).
 */
import { normalizeCharacterName, settlementCurrency } from "@bellgrave/config";
import { createPublicClient, http, type Hex } from "viem";
import { freshMintNonce, mintClaimMessage } from "./mint-claim";
import { clearPendingMint, readPendingMint, writePendingMint } from "./pending-mint";
import { appKitConfigured } from "./appkit";
import { hasInjectedWallet, payWalletSessionOpts } from "./pay-wallet";
import { burnerAccount, getWalletSession } from "./wallet";

const CREATE_FOR_ABI = [
  {
    type: "function",
    name: "createCharacterFor",
    stateMutability: "payable",
    inputs: [
      { name: "startingJob", type: "uint8" },
      { name: "expectedTokenId", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

const CREATE_ABI = [
  {
    type: "function",
    name: "createCharacter",
    stateMutability: "payable",
    inputs: [{ name: "startingJob", type: "uint8" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

const OWNER_ABI = [
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
] as const;

export type CharacterMintConfig = {
  factory: string;
  nft: string;
  mintFee: string;
  chainId: number;
  rpcUrl: string;
  supportsCreateFor?: boolean;
  suggestedTokenId?: string;
  devFaucet?: boolean;
  devServerMint?: boolean;
};

export type MintResult =
  | {
      ok: true;
      hash: Hex | "reuse";
      tokenId: string;
      payer: string;
      charId: string;
      reused?: boolean;
      mintNonce?: string;
      mintExpiry?: number;
      mintSignature?: string;
    }
  | { ok: false; error: string };

async function signClaim(opts: {
  session: Awaited<ReturnType<typeof getWalletSession>>;
  tokenId: string;
  gameWallet: string;
  chainId: number;
  charId: string;
}): Promise<{ mintNonce: string; mintExpiry: number; mintSignature: string }> {
  const mintNonce = freshMintNonce();
  const mintExpiry = Math.floor(Date.now() / 1000) + 10 * 60;
  const message = mintClaimMessage({
    tokenId: opts.tokenId,
    gameWallet: opts.gameWallet,
    chainId: opts.chainId,
    charId: opts.charId,
    nonce: mintNonce,
    expiry: mintExpiry,
  });
  const mintSignature = await opts.session.client.signMessage({
    message,
    account: opts.session.account,
  });
  return { mintNonce, mintExpiry, mintSignature };
}

export async function mintCharacterWithWallet(opts: {
  mint: CharacterMintConfig;
  job: number;
  /** Game auth wallet (burner) that will own the log character. */
  gameWallet: string;
  /** Character name bound into the mint claim (same rules as server). */
  charId: string;
  tokenId?: string;
  /** When true, skip payment and reuse a pending unbound NFT if still owned. */
  allowReuse?: boolean;
}): Promise<MintResult> {
  const named = normalizeCharacterName(opts.charId);
  if (!named.ok) return { ok: false, error: named.error };

  if (!Number.isInteger(opts.job) || opts.job < 0 || opts.job > 255) {
    return { ok: false, error: "Bad job for mint." };
  }
  let fee: bigint;
  try {
    fee = BigInt(opts.mint.mintFee);
  } catch {
    return { ok: false, error: "Bad mint fee." };
  }
  const cur = settlementCurrency(opts.mint.chainId);
  const chain = {
    id: opts.mint.chainId,
    name: cur.name,
    nativeCurrency: { name: cur.name, symbol: cur.symbol, decimals: cur.decimals },
    rpcUrls: { default: { http: [opts.mint.rpcUrl] } },
  };
  const hasInjected = hasInjectedWallet();
  const sessionFlags = payWalletSessionOpts({
    hasInjected,
    appKitConfigured: appKitConfigured(),
  });
  try {
    const session = await getWalletSession({
      chainId: opts.mint.chainId,
      rpcUrl: opts.mint.rpcUrl,
      allowBurnerFallback: sessionFlags.allowBurnerFallback,
      preferWalletConnect: sessionFlags.preferWalletConnect,
    });
    const pub = createPublicClient({
      transport: http(opts.mint.rpcUrl),
    });
    const payer = session.address.toLowerCase();
    const game = opts.gameWallet.toLowerCase();

    // M-C: reuse an already-paid unbound NFT when still held by the payer.
    if (opts.allowReuse !== false) {
      const pending = readPendingMint(game);
      if (
        pending &&
        pending.chainId === opts.mint.chainId &&
        pending.factory.toLowerCase() === opts.mint.factory.toLowerCase() &&
        pending.nft.toLowerCase() === opts.mint.nft.toLowerCase()
      ) {
        try {
          const owner = (
            await pub.readContract({
              address: opts.mint.nft as `0x${string}`,
              abi: OWNER_ABI,
              functionName: "ownerOf",
              args: [BigInt(pending.tokenId)],
            })
          ).toLowerCase();
          if (owner === pending.payer.toLowerCase() || owner === payer) {
            if (payer === game && pending.payer.toLowerCase() === game) {
              return {
                ok: true,
                hash: "reuse",
                tokenId: pending.tokenId,
                payer: pending.payer.toLowerCase(),
                charId: named.name,
                reused: true,
              };
            }
            const claim = await signClaim({
              session,
              tokenId: pending.tokenId,
              gameWallet: game,
              chainId: opts.mint.chainId,
              charId: named.name,
            });
            return {
              ok: true,
              hash: "reuse",
              tokenId: pending.tokenId,
              payer: pending.payer.toLowerCase(),
              charId: named.name,
              reused: true,
              ...claim,
            };
          }
        } catch {
          clearPendingMint(game);
        }
      }
    }

    const expected =
      opts.tokenId && /^[1-9][0-9]{0,77}$/.test(opts.tokenId)
        ? opts.tokenId
        : opts.mint.supportsCreateFor &&
            opts.mint.suggestedTokenId &&
            /^[1-9][0-9]{0,77}$/.test(opts.mint.suggestedTokenId)
          ? opts.mint.suggestedTokenId
          : undefined;

    let hash: Hex | undefined;
    let tokenId: string | undefined;

    const useCreateFor = !!expected && opts.mint.supportsCreateFor !== false;
    if (useCreateFor && expected) {
      try {
        hash = await session.client.writeContract({
          address: opts.mint.factory as `0x${string}`,
          abi: CREATE_FOR_ABI,
          functionName: "createCharacterFor",
          args: [opts.job, BigInt(expected)],
          value: fee,
          account: session.account,
          chain,
        });
        tokenId = expected;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!/createCharacterFor|WrongTokenId|not found/i.test(msg)) throw err;
        hash = undefined;
        tokenId = undefined;
      }
    }
    if (!hash) {
      hash = await session.client.writeContract({
        address: opts.mint.factory as `0x${string}`,
        abi: CREATE_ABI,
        functionName: "createCharacter",
        args: [opts.job],
        value: fee,
        account: session.account,
        chain,
      });
    }

    const receipt = await pub.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      return { ok: false, error: "Character mint reverted." };
    }
    if (!tokenId) {
      for (const log of receipt.logs) {
        if (log.topics.length >= 3 && log.address.toLowerCase() === opts.mint.factory.toLowerCase()) {
          try {
            tokenId = BigInt(log.topics[2]!).toString();
            break;
          } catch {
            /* ignore */
          }
        }
      }
    }
    if (!tokenId) {
      return { ok: false, error: "Mint succeeded but no token id was returned." };
    }

    writePendingMint({
      tokenId,
      payer,
      chainId: opts.mint.chainId,
      factory: opts.mint.factory.toLowerCase(),
      nft: opts.mint.nft.toLowerCase(),
      gameWallet: game,
    });

    if (payer === game) {
      return { ok: true, hash, tokenId, payer, charId: named.name };
    }

    const claim = await signClaim({
      session,
      tokenId,
      gameWallet: game,
      chainId: opts.mint.chainId,
      charId: named.name,
    });
    return { ok: true, hash, tokenId, payer, charId: named.name, ...claim };
  } catch (err) {
    if (hasInjected) {
      try {
        burnerAccount();
      } catch {
        /* ignore */
      }
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export { clearPendingMint };
