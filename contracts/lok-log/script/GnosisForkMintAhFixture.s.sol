// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {CharacterNFT} from "../src/CharacterNFT.sol";
import {CharacterCheckpoint} from "../src/CharacterCheckpoint.sol";
import {CharacterFactory} from "../src/CharacterFactory.sol";
import {AhEscrow} from "../src/AhEscrow.sol";

/// Minimal CharacterFactory (1 xDAI mint fee) + AhEscrow for Gnosis-fork e2e.
/// Broadcast only against a local `anvil --fork-url` — never public mainnet RPCs.
contract GnosisForkMintAhFixture is Script {
    function run() external {
        address admin = msg.sender;
        uint256 mintFee = 1 ether;
        vm.startBroadcast();
        CharacterNFT nft = CharacterNFT(
            address(
                new ERC1967Proxy(
                    address(new CharacterNFT()),
                    abi.encodeCall(CharacterNFT.initialize, (admin, "Bellgrave", "BGRV", "ipfs://x/"))
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
                    abi.encodeCall(CharacterFactory.initialize, (admin, address(nft), address(cp), mintFee))
                )
            )
        );
        nft.setState(address(cp));
        nft.grantRole(nft.MINTER_ROLE(), address(factory));
        cp.grantRole(cp.FACTORY_ROLE(), address(factory));
        cp.grantRole(cp.NFT_ROLE(), address(nft));
        factory.setStartingJob(0, true);
        factory.setStartingJob(1, true);

        AhEscrow escrow = new AhEscrow(admin, address(nft), payable(admin));
        // Constructor already grants LISTING_ROLE to admin (= deployer / anvil key0).

        vm.stopBroadcast();
        console.log("NFT", address(nft));
        console.log("FACTORY", address(factory));
        console.log("ESCROW", address(escrow));
        console.log("MINT_FEE", mintFee);
        console.log("CHAINID", block.chainid);
    }
}
