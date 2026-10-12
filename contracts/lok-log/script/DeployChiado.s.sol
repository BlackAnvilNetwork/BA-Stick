// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {console} from "forge-std/Script.sol";
import {Deploy} from "./Deploy.s.sol";

/// Chiado (chain id 10200) deploy entrypoint — native xDAI mint fee / AH prices.
/// Defaults `MINT_FEE` to 1 ether (= 1 xDAI). Does not hardcode RPC; pass `--rpc-url`.
///
///   forge script script/DeployChiado.s.sol:DeployChiado --rpc-url $CHIADO_RPC_URL --sig "run()"
///   Add `--broadcast` only after explicit go-ahead.
///
/// Env: same as Deploy.s.sol (MULTISIG, ROTATOR, GUARDIAN, PROPOSER, ITEMS, KEK, BASE_URI)
///      + optional LISTING, MINT_FEE (wei; default 1e18).
contract DeployChiado is Deploy {
    function run() external override returns (Deployed memory d) {
        Config memory c = Config({
            multisig: vm.envAddress("MULTISIG"),
            rotator: vm.envAddress("ROTATOR"),
            guardian: vm.envAddress("GUARDIAN"),
            proposer: vm.envAddress("PROPOSER"),
            listing: vm.envOr("LISTING", address(0)),
            items: vm.envAddress("ITEMS"),
            kek: vm.envAddress("KEK"),
            baseURI: vm.envString("BASE_URI"),
            // 1 xDAI default — see docs/mainnet-plan.md (flagged for product).
            mintFee: vm.envOr("MINT_FEE", uint256(1 ether))
        });
        console.log("DeployChiado mintFee (wei)", c.mintFee);
        vm.startBroadcast();
        d = deploy(c, msg.sender);
        vm.stopBroadcast();
        console.log("CharacterNFT        ", address(d.nft));
        console.log("CharacterCheckpoint ", address(d.checkpoint));
        console.log("CharacterFactory    ", address(d.factory));
        console.log("RulesetRegistry     ", address(d.rulesets));
        console.log("AhEscrow            ", address(d.ahEscrow));
    }
}
