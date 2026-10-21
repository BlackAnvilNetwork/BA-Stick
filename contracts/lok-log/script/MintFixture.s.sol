// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {CharacterNFT} from "../src/CharacterNFT.sol";
import {CharacterCheckpoint} from "../src/CharacterCheckpoint.sol";
import {CharacterFactory} from "../src/CharacterFactory.sol";

/// Minimal character mint stack for throwaway-anvil support tests (not production Deploy).
contract MintFixture is Script {
    function run() external {
        address admin = msg.sender;
        vm.startBroadcast();
        CharacterNFT nft = CharacterNFT(
            address(
                new ERC1967Proxy(
                    address(new CharacterNFT()),
                    abi.encodeCall(CharacterNFT.initialize, (admin, "C", "C", "ipfs://x/"))
                )
            )
        );
        CharacterCheckpoint cp = CharacterCheckpoint(
            address(
                new ERC1967Proxy(
                    address(new CharacterCheckpoint()),
                    abi.encodeCall(CharacterCheckpoint.initialize, (admin, address(nft), admin, admin))
                )
            )
        );
        CharacterFactory factory = CharacterFactory(
            address(
                new ERC1967Proxy(
                    address(new CharacterFactory()),
                    abi.encodeCall(CharacterFactory.initialize, (admin, address(nft), address(cp), 0.001 ether))
                )
            )
        );
        nft.setState(address(cp));
        nft.grantRole(nft.MINTER_ROLE(), address(factory));
        cp.grantRole(cp.FACTORY_ROLE(), address(factory));
        cp.grantRole(cp.NFT_ROLE(), address(nft));
        factory.setStartingJob(0, true);
        factory.setStartingJob(1, true);
        vm.stopBroadcast();
        console.log("NFT", address(nft));
        console.log("FACTORY", address(factory));
    }
}
