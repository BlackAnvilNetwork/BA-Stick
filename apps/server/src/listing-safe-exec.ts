/**
 * Listing and PvP operator calls.
 *
 * With no Listing Safe, the listing owner key sends the call itself. That is
 * the anvil path, where the key holds the role.
 *
 * With LOK_LISTING_SAFE, the role is on that Safe. The owner key signs a
 * threshold-1 Safe transaction and pays the gas. The Safe is msg.sender.
 */
import {
  encodeFunctionData,
  getAddress,
  isAddress,
  zeroAddress,
  type Abi,
  type Account,
  type Chain,
  type ContractFunctionArgs,
  type ContractFunctionName,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";

const SAFE_ABI = [
  {
    type: "function",
    name: "nonce",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getTransactionHash",
    stateMutability: "view",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
      { name: "operation", type: "uint8" },
      { name: "safeTxGas", type: "uint256" },
      { name: "baseGas", type: "uint256" },
      { name: "gasPrice", type: "uint256" },
      { name: "gasToken", type: "address" },
      { name: "refundReceiver", type: "address" },
      { name: "_nonce", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "execTransaction",
    stateMutability: "payable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
      { name: "operation", type: "uint8" },
      { name: "safeTxGas", type: "uint256" },
      { name: "baseGas", type: "uint256" },
      { name: "gasPrice", type: "uint256" },
      { name: "gasToken", type: "address" },
      { name: "refundReceiver", type: "address" },
      { name: "signatures", type: "bytes" },
    ],
    outputs: [{ name: "success", type: "bool" }],
  },
] as const;

type ListingAccount = Account & {
  signMessage: (args: { message: { raw: Hex } }) => Promise<Hex>;
};

/** Listing Safe address. Blank and the zero address mean the key sends directly. */
export function listingSafeAddress(env: NodeJS.ProcessEnv = process.env): `0x${string}` | null {
  const raw = env.LOK_LISTING_SAFE?.trim() ?? "";
  if (!raw || !isAddress(raw) || raw.toLowerCase() === zeroAddress) return null;
  return getAddress(raw);
}

/**
 * Safe recovers eth_sign signatures with v - 4. viem's signMessage uses v 27 or 28.
 */
export function ethSignSafeSignature(signature: Hex): Hex {
  if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) throw new Error("listing signature is not 65 bytes");
  const v = Number.parseInt(signature.slice(-2), 16);
  const adjusted = v === 27 || v === 28 ? v + 4 : v;
  if (adjusted !== 31 && adjusted !== 32) throw new Error("listing signature v is not an eth_sign recovery id");
  return (signature.slice(0, -2) + adjusted.toString(16)) as Hex;
}

export async function sendListingRoleCall<
  const abi extends Abi,
  functionName extends ContractFunctionName<abi, "nonpayable">,
>(opts: {
  env?: NodeJS.ProcessEnv;
  wallet: Pick<WalletClient, "writeContract">;
  pub: PublicClient;
  account: ListingAccount;
  chain: Chain | null | undefined;
  address: `0x${string}`;
  abi: abi;
  functionName: functionName;
  args: ContractFunctionArgs<abi, "nonpayable", functionName>;
  nonce?: number;
}): Promise<Hex> {
  const env = opts.env ?? process.env;
  const chain = opts.chain ?? undefined;
  const safe = listingSafeAddress(env);
  if (!safe) {
    return opts.wallet.writeContract({
      address: opts.address,
      abi: opts.abi,
      functionName: opts.functionName,
      args: opts.args,
      account: opts.account,
      chain,
      ...(opts.nonce != null ? { nonce: opts.nonce } : {}),
    } as Parameters<WalletClient["writeContract"]>[0]);
  }
  const data = encodeFunctionData({
    abi: opts.abi,
    functionName: opts.functionName,
    args: opts.args,
  });
  const safeNonce = await opts.pub.readContract({
    address: safe,
    abi: SAFE_ABI,
    functionName: "nonce",
  });
  const safeTxHash = await opts.pub.readContract({
    address: safe,
    abi: SAFE_ABI,
    functionName: "getTransactionHash",
    args: [opts.address, 0n, data, 0, 0n, 0n, 0n, zeroAddress, zeroAddress, safeNonce],
  });
  const signature = ethSignSafeSignature(await opts.account.signMessage({ message: { raw: safeTxHash } }));
  return opts.wallet.writeContract({
    address: safe,
    abi: SAFE_ABI,
    functionName: "execTransaction",
    args: [opts.address, 0n, data, 0, 0n, 0n, 0n, zeroAddress, zeroAddress, signature],
    account: opts.account,
    chain,
    ...(opts.nonce != null ? { nonce: opts.nonce } : {}),
  } as Parameters<WalletClient["writeContract"]>[0]);
}
