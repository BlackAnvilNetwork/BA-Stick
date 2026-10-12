// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AhEscrow} from "../src/AhEscrow.sol";
import {MockOwnerNft} from "../test/mocks/MockOwnerNft.sol";

/// @dev Throwaway-anvil helper: deploy AhEscrow + MockOwnerNft with deployer as admin/fee.
contract AhEscrowFixture is Script {
    function run() external {
        MockOwnerNft nft = new MockOwnerNft();
        AhEscrow escrow = new AhEscrow(msg.sender, address(nft), payable(msg.sender));
        console.log("ESCROW", address(escrow));
        console.log("NFT", address(nft));
        console.log("FEE", msg.sender);
    }
}
