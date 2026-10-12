// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AhEscrow} from "../src/AhEscrow.sol";

/// @dev Throwaway-anvil helper: deploy AhEscrow with deployer as LISTING_ROLE admin.
contract AhEscrowFixture is Script {
    function run() external {
        vm.startBroadcast();
        AhEscrow escrow = new AhEscrow(msg.sender);
        console.log("ESCROW", address(escrow));
        vm.stopBroadcast();
    }
}
