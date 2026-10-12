// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AhEscrow} from "../src/AhEscrow.sol";
import {MockEezSyncBuy} from "../src/MockEezSyncBuy.sol";

/// Deploy MockEezSyncBuy against an existing AhEscrow (throwaway-anvil support tests).
contract EezMockFixture is Script {
    function run() external {
        address escrow = vm.envAddress("EEZ_ESCROW");
        vm.startBroadcast();
        MockEezSyncBuy mock = new MockEezSyncBuy(AhEscrow(payable(escrow)), 31337);
        vm.stopBroadcast();
        console.log("MOCK", address(mock));
    }
}
