// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {console} from "forge-std/Script.sol";
import {Deploy} from "./Deploy.s.sol";

/// Chiado / Gnosis deploy entrypoint — native xDAI mint fee (default 1 xDAI).
/// Uses the same role-separated Config as Deploy (ADMIN Safe, distinct server keys, FEE_RECIPIENT).
/// ITEMS/KEK default to address(0) (imports/exports off). Never wire MockItems off-anvil.
///
///   forge script script/DeployChiado.s.sol:DeployChiado --rpc-url $RPC --sig "run()"
///   Add `--broadcast` only after explicit go-ahead. Then run script/verify-deploy.sh.
contract DeployChiado is Deploy {
    function run() external override returns (Deployed memory d) {
        Config memory c = loadConfig();
        // Chiado/Gnosis default mint fee = 1 xDAI when MINT_FEE unset.
        c.mintFee = vm.envOr("MINT_FEE", uint256(1 ether));
        console.log("DeployChiado mintFee (wei)", c.mintFee);
        vm.startBroadcast();
        d = deploy(c, msg.sender);
        vm.stopBroadcast();
        _logDeployed(d, c);
    }
}
