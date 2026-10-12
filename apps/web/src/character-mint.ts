/**
 * Player-paid CharacterFactory mint (native ETH fee — same unit as AhEscrow / EEZ).
 * Prefer createCharacterFor when the factory supports it and a suggested id is known.
 */
import { createPublicClient, http, type Hex } from "viem";
import { freshMintNonce, mintClaimMessage } from "./mint-claim";
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
      hash: Hex;
      tokenId: string;
      payer: string;
      mintNonce?: string;
      mintExpiry?: number;
      mintSignature?: string;
    }
  | { ok: false; error: string };

export async function mintCharacterWithWallet(opts: {
  mint: CharacterMintConfig;
  job: number;
  /** Game auth wallet (burner) that will own the log character. */
  gameWallet: string;
  /** Character name bound into the mint claim (L3). */
  charId: string;
  tokenId?: string;
}): Promise<MintResult> {
  if (!Number.isInteger(opts.job) || opts.job < 0 || opts.job > 255) {
    return { ok: false, error: "Bad job for mint." };
  }
  let fee: bigint;
  try {
    fee = BigInt(opts.mint.mintFee);
  } catch {
    return { ok: false, error: "Bad mint fee." };
  }
  const chain = {
    id: opts.mint.chainId,
    name: "Bellgrave",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [opts.mint.rpcUrl] } },
  };
  const hasInjected = typeof window !== "undefined" && !!window.ethereum;
  try {
    // F3: if an extension is present, declining must not silently use the burner for payment.
    // When there is no extension, the burner is the only wallet (local auth).
    const session = await getWalletSession({
      chainId: opts.mint.chainId,
      rpcUrl: opts.mint.rpcUrl,
      allowBurnerFallback: !hasInjected,
    });
    const pub = createPublicClient({
      transport: http(opts.mint.rpcUrl),
    });

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

    const payer = session.address.toLowerCase();
    const game = opts.gameWallet.toLowerCase();
    if (payer === game) {
      return { ok: true, hash, tokenId, payer };
    }

    // H1/L3: prove mintWallet controls the claim for this game wallet + chain + char.
    const mintNonce = freshMintNonce();
    const mintExpiry = Math.floor(Date.now() / 1000) + 10 * 60;
    const charId = opts.charId.trim();
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(charId)) {
      return { ok: false, error: "Bad character id for mint claim." };
    }
    const message = mintClaimMessage({
      tokenId,
      gameWallet: game,
      chainId: opts.mint.chainId,
      charId,
      nonce: mintNonce,
      expiry: mintExpiry,
    });
    const mintSignature = await session.client.signMessage({
      message,
      account: session.account,
    });
    return { ok: true, hash, tokenId, payer, mintNonce, mintExpiry, mintSignature };
  } catch (err) {
    // If extension was declined, surface that — do not mint from burner behind the user's back.
    if (hasInjected) {
      try {
        burnerAccount(); // ensure burner exists for auth, but do not pay with it here
      } catch {
        /* ignore */
      }
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
