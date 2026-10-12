/**
 * Player-paid CharacterFactory.createCharacterFor{value: mintFee}(job, tokenId).
 * Native ETH fee (same unit as AhEscrow / EEZ msg.value — not WETH).
 * The server no longer pays the fee from LOK_OWNER_KEY unless LOK_DEV_SERVER_MINT=1.
 */
import { createPublicClient, http, type Hex } from "viem";
import { getWalletSession } from "./wallet";

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
};

export async function mintCharacterWithWallet(opts: {
  mint: CharacterMintConfig;
  job: number;
  /** Log token id — required so payment binds to this character (createCharacterFor). */
  tokenId?: string;
}): Promise<{ ok: true; hash: Hex; tokenId?: string; payer: string } | { ok: false; error: string }> {
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
  try {
    // Mint/pay flows: do not silently fall back when the user declines the extension.
    const session = await getWalletSession({
      chainId: opts.mint.chainId,
      rpcUrl: opts.mint.rpcUrl,
      allowBurnerFallback: true, // local auth is burner; faucet funds it on 31337
    });
    const pub = createPublicClient({
      transport: http(opts.mint.rpcUrl),
    });

    if (opts.tokenId && /^[1-9][0-9]{0,77}$/.test(opts.tokenId)) {
      const hash = await session.client.writeContract({
        address: opts.mint.factory as `0x${string}`,
        abi: CREATE_FOR_ABI,
        functionName: "createCharacterFor",
        args: [opts.job, BigInt(opts.tokenId)],
        value: fee,
        account: session.account,
        chain,
      });
      const receipt = await pub.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        return { ok: false, error: "createCharacterFor reverted." };
      }
      return { ok: true, hash, tokenId: opts.tokenId, payer: session.address };
    }

    // Mint-first path (no log token yet): plain createCharacter, return minted id from receipt logs if needed.
    const hash = await session.client.writeContract({
      address: opts.mint.factory as `0x${string}`,
      abi: CREATE_ABI,
      functionName: "createCharacter",
      args: [opts.job],
      value: fee,
      account: session.account,
      chain,
    });
    const receipt = await pub.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      return { ok: false, error: "createCharacter reverted." };
    }
    // CharacterCreated(player, tokenId, job) — topic0 + player + tokenId
    let mintedId: string | undefined;
    for (const log of receipt.logs) {
      if (log.topics.length >= 3 && log.address.toLowerCase() === opts.mint.factory.toLowerCase()) {
        try {
          mintedId = BigInt(log.topics[2]!).toString();
          break;
        } catch {
          /* ignore */
        }
      }
    }
    return { ok: true, hash, tokenId: mintedId, payer: session.address };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
