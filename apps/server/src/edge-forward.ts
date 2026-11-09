/**
 * A non-leader accepts a signed player input and sends it to the epoch leader.
 * It does not append. The leader checks the signature, so the edge cannot forge
 * the action. char/create uses this path when this process is not the leader.
 */
import { recoverMessageAddress, type Hex } from "viem";

export const INPUT_PREFIX = "LOK_INPUT_V1";

export type SpawnInput = {
  op: "spawn";
  wallet: string;
  tokenId: string;
  startingJob: number;
  name: string;
  signature: Hex;
};

export function spawnInputMessage(input: Omit<SpawnInput, "signature">): string {
  return [
    INPUT_PREFIX,
    "spawn",
    input.wallet.toLowerCase(),
    input.tokenId,
    String(input.startingJob),
    input.name,
  ].join("|");
}

export async function recoverSpawnSigner(input: SpawnInput): Promise<string | null> {
  try {
    const address = await recoverMessageAddress({
      message: spawnInputMessage(input),
      signature: input.signature,
    });
    return address.toLowerCase();
  } catch {
    return null;
  }
}

export function validateSpawnInput(
  input: SpawnInput,
  signer: string | null,
  local: { tokenInJournal: boolean; nameTaken: boolean },
): { ok: true } | { ok: false; error: string } {
  if (!signer || signer !== input.wallet.toLowerCase()) {
    return { ok: false, error: "The leader cannot accept an unsigned action." };
  }
  if (local.tokenInJournal) return { ok: false, error: "That character is already on the journal." };
  if (local.nameTaken) return { ok: false, error: "That name is already on the log. Pick another." };
  if (!/^[1-9][0-9]{0,77}$/.test(input.tokenId)) return { ok: false, error: "Bad character token id." };
  return { ok: true };
}

export type WritePath = "local" | "forward" | "refuse";

export function decideWritePath(canAppend: boolean, canForward: boolean): WritePath {
  if (canAppend) return "local";
  if (canForward) return "forward";
  return "refuse";
}

export const APPEND_REFUSED = "This server does not write the journal.";
export const FORWARD_NEEDS_SIGNATURE = "Sign this action for the leader.";
