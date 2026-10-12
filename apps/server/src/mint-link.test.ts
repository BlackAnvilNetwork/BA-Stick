/**
 * Unit tests for character mint link helpers (no chain required).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  characterMintClientConfig,
  characterMintEnvConfigured,
  linkCharacterNft,
  LOCAL_ANVIL_CHAIN_ID,
  loadCharacterMintClientConfig,
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

  it("loadCharacterMintClientConfig reports disabled when env is incomplete", async () => {
    const loaded = await loadCharacterMintClientConfig({
      LOK_CHAIN_RPC: "",
      LOK_FACTORY: "",
      LOK_NFT: "",
    } as NodeJS.ProcessEnv);
    assert.equal(loaded.status, "disabled");
  });

  it("characterMintEnvConfigured requires rpc + factory + nft", () => {
    assert.equal(characterMintEnvConfigured({} as NodeJS.ProcessEnv), false);
    assert.equal(
      characterMintEnvConfigured({
        LOK_CHAIN_RPC: "http://127.0.0.1:8545",
        LOK_FACTORY: "0x00000000000000000000000000000000000000f1",
        LOK_NFT: "0x00000000000000000000000000000000000000f2",
      } as NodeJS.ProcessEnv),
      true,
    );
  });

  it("loadCharacterMintClientConfig fails closed (error) when RPC is unreachable", async () => {
    const loaded = await loadCharacterMintClientConfig({
      LOK_CHAIN_RPC: "http://127.0.0.1:1",
      LOK_FACTORY: "0x00000000000000000000000000000000000000f1",
      LOK_NFT: "0x00000000000000000000000000000000000000f2",
    } as NodeJS.ProcessEnv);
    assert.equal(loaded.status, "error");
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
