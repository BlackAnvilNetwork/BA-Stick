// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";

/// Deploy OpenZeppelin TimelockController for UUPS upgradeAuthority on Gnosis.
///
/// Roles (EOA-friendly production launch):
///   - PROPOSER EOA → PROPOSER_ROLE (schedule upgrades / admin ops on the timelock)
///   - ADMIN EOA → EXECUTOR_ROLE (execute after minDelay) + timelock `admin` (grant/revoke)
///
///   forge script script/DeployTimelock.s.sol:DeployTimelock --rpc-url $RPC_URL --broadcast
///   env: ADMIN, PROPOSER, optional MIN_DELAY_SECONDS (default 86400 = 1 day)
contract DeployTimelock is Script {
    function run() external returns (address timelock) {
        address admin = vm.envAddress("ADMIN");
        address proposer = vm.envAddress("PROPOSER");
        uint256 minDelay = vm.envOr("MIN_DELAY_SECONDS", uint256(1 days));

        address[] memory proposers = new address[](1);
        proposers[0] = proposer;
        address[] memory executors = new address[](1);
        executors[0] = admin;

        vm.startBroadcast();
        timelock = address(new TimelockController(minDelay, proposers, executors, admin));
        vm.stopBroadcast();

        console.log("TimelockController", timelock);
        console.log("minDelaySeconds", minDelay);
        console.log("proposer", proposer);
        console.log("executorAdmin", admin);
    }
}
