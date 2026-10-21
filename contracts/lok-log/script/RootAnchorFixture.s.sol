// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {RootAnchor} from "../src/RootAnchor.sol";

/// @dev Throwaway-anvil helper. The broadcast key is the anchor poster, not the listing key.
contract RootAnchorFixture is Script {
    function run() external {
        vm.startBroadcast();
        RootAnchor anchor = new RootAnchor();
        vm.stopBroadcast();
        console.log("ANCHOR", address(anchor));
    }
}
