/**
 * Unit tests for character mint link helpers (no chain required).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  characterMintClientConfig,
  linkCharacterNft,
  LOCAL_ANVIL_CHAIN_ID,
} from "./lok-vault";

describe("character mint link helpers", () => {
  it("characterMintClientConfig returns null when chain env is incomplete", async () => {
    const cfg = await characterMintClientConfig({
      LOK_CHAIN_RPC: "",
      LOK_FACTORY: "",
      LOK_NFT: "",
    } as NodeJS.ProcessEnv);
    assert.equal(cfg, null);
  });

  it("linkCharacterNft reports not configured without RPC", async () => {
    const res = await linkCharacterNft("1", 0, "0x0000000000000000000000000000000000000001", {
      LOK_CHAIN_RPC: "",
      LOK_FACTORY: "",
      LOK_NFT: "",
    } as NodeJS.ProcessEnv);
    assert.equal(res.ok, false);
    assert.match(res.error, /not configured/i);
  });

  it("LOCAL_ANVIL_CHAIN_ID is 31337", () => {
    assert.equal(LOCAL_ANVIL_CHAIN_ID, 31337n);
  });
});
