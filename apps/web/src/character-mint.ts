/**
 * Player-paid CharacterFactory.createCharacter{value: mintFee}.
 * The server no longer pays the fee from LOK_OWNER_KEY.
 */
import { createPublicClient, http, type Hex } from "viem";
import { getWalletSession } from "./wallet";

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
}): Promise<{ ok: true; hash: Hex } | { ok: false; error: string }> {
  if (!Number.isInteger(opts.job) || opts.job < 0 || opts.job > 255) {
    return { ok: false, error: "Bad job for mint." };
  }
  let fee: bigint;
  try {
    fee = BigInt(opts.mint.mintFee);
  } catch {
    return { ok: false, error: "Bad mint fee." };
  }
  try {
    const session = await getWalletSession({
      chainId: opts.mint.chainId,
      rpcUrl: opts.mint.rpcUrl,
    });
    const pub = createPublicClient({
      transport: http(opts.mint.rpcUrl),
    });
    const hash = await session.client.writeContract({
      address: opts.mint.factory as `0x${string}`,
      abi: CREATE_ABI,
      functionName: "createCharacter",
      args: [opts.job],
      value: fee,
      account: session.account,
      chain: {
        id: opts.mint.chainId,
        name: "Bellgrave",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: { default: { http: [opts.mint.rpcUrl] } },
      },
    });
    const receipt = await pub.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      return { ok: false, error: "createCharacter reverted." };
    }
    return { ok: true, hash };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
