import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { applySettlementDeployFile } from "./settlement-deploy";

describe("applySettlementDeployFile", () => {
  it("fills blank LOK_* from deploy JSON on chain 100 and skips MockItems", () => {
    const dir = mkdtempSync(join(tmpdir(), "lok-deploy-"));
    const path = join(dir, "gnosis.json");
    writeFileSync(
      path,
      JSON.stringify({
        chainId: 100,
        deployBlock: 42_000_000,
        contracts: {
          CharacterNFT: "0x1111111111111111111111111111111111111111",
          CharacterFactory: "0x2222222222222222222222222222222222222222",
          AhEscrow: "0x3333333333333333333333333333333333333333",
          CharacterCheckpoint: "0x4444444444444444444444444444444444444444",
          RulesetRegistry: "0x5555555555555555555555555555555555555555",
          MockItems: "0x6666666666666666666666666666666666666666",
          Items: "0x7777777777777777777777777777777777777777",
        },
      }),
    );
    const env: NodeJS.ProcessEnv = {
      LOK_CHAIN_ID: "100",
      LOK_DEPLOY_JSON: path,
    };
    applySettlementDeployFile(env);
    assert.equal(env.LOK_NFT, "0x1111111111111111111111111111111111111111");
    assert.equal(env.LOK_FACTORY, "0x2222222222222222222222222222222222222222");
    assert.equal(env.LOK_AH_ESCROW, "0x3333333333333333333333333333333333333333");
    assert.equal(env.LOK_ITEMS, "0x7777777777777777777777777777777777777777");
    assert.equal(env.LOK_CHECKPOINT, "0x4444444444444444444444444444444444444444");
    assert.ok(env.LOK_CHAIN_RPC?.includes("gnosis"));
    assert.equal(env.LOK_DEPLOY_BLOCK, "42000000");
    assert.ok(env.LOK_CHAIN_RPC_URLS?.includes(","));
  });

  it("NETWORK=gnosis selects chain 100 + confirmations + explorer without LOK_CHAIN_ID", () => {
    const env: NodeJS.ProcessEnv = { NETWORK: "gnosis" };
    applySettlementDeployFile(env);
    assert.equal(env.LOK_CHAIN_ID, "100");
    assert.equal(env.LOK_CONFIRMATIONS, "2");
    assert.equal(env.LOK_EXPLORER, "https://gnosisscan.io");
    assert.ok(env.LOK_CHAIN_RPC?.includes("gnosis"));
  });

  it("does not override existing env on anvil", () => {
    const env: NodeJS.ProcessEnv = {
      NETWORK: "anvil",
      LOK_NFT: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    };
    applySettlementDeployFile(env);
    assert.equal(env.LOK_CHAIN_ID, "31337");
    assert.equal(env.LOK_NFT, "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    assert.equal(env.LOK_AH_ESCROW, undefined);
  });
});
