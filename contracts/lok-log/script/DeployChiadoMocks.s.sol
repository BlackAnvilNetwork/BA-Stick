// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MockKEK, MockItems} from "../test/mocks/Mocks.sol";

/// Deploys Chiado placeholder ITEMS (ERC-1155) + KEK (ERC-20) for DeployChiado wiring.
/// Not production tokens — exports stay non-functional until real tokens are set.
contract DeployChiadoMocks is Script {
    function run() external returns (address items, address kek) {
        vm.startBroadcast();
        items = address(new MockItems());
        kek = address(new MockKEK());
        vm.stopBroadcast();
        console.log("MockItems", items);
        console.log("MockKEK  ", kek);
    }
}
