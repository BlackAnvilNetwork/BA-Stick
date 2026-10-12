// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MockKEK, MockItems} from "../test/mocks/Mocks.sol";

/// Local-anvil ONLY placeholder ITEMS/KEK. Reverts on any other chainid.
/// Official / Chiado / Gnosis deploys must never call this script.
contract DeployChiadoMocks is Script {
    error MocksOnlyOnAnvil(uint256 chainId);

    function run() external returns (address items, address kek) {
        if (block.chainid != 31337) revert MocksOnlyOnAnvil(block.chainid);
        vm.startBroadcast();
        items = address(new MockItems());
        kek = address(new MockKEK());
        vm.stopBroadcast();
        console.log("MockItems", items);
        console.log("MockKEK  ", kek);
        console.log("WARNING: anvil-only mocks - do not wire on 100/10200");
    }
}
