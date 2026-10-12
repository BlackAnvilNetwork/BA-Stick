// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {CharacterNFT} from "../src/CharacterNFT.sol";
import {CharacterCheckpoint} from "../src/CharacterCheckpoint.sol";
import {CharacterFactory} from "../src/CharacterFactory.sol";
import {RulesetRegistry} from "../src/RulesetRegistry.sol";
import {AhEscrow} from "../src/AhEscrow.sol";
// KekVault.sol + CharacterCheckpoint.vault stay until a batched redeploy drops custody deposits.
// Play path AH uses AhEscrow (deployed and granted LISTING_ROLE here).

/// Deploys the log-model character stack behind UUPS proxies, wires roles, then hands admin to the multisig.
/// The deployer is the temporary admin and renounces at the end. Items (ERC-1155) and KEK (ERC-20) are external:
/// pass their addresses in.
///
///   forge script script/Deploy.s.sol --rpc-url $RPC --broadcast --sig "run()"
///   env: MULTISIG, ROTATOR, GUARDIAN, PROPOSER, ITEMS, KEK, BASE_URI
///   optional: LISTING (EOA that signs openAsk/cancelAsk; defaults to ROTATOR)
///
/// After running, the multisig must still:
///   1. items.setMinter(checkpoint, true)            (checkpoint mints exports and burns imports)
///   2. factory.setStartingJob(job, true)            (per starting job)
///   3. proposer: rulesets.propose(hash, delay, uri) (first ruleset; wait out the timelock)
///   4. rotator service: checkpoint.addSigner(sessionKey, expiry)
contract Deploy is Script {
    uint64 constant RULESET_MIN_DELAY = 48 hours;

    struct Config {
        address multisig;
        address rotator;
        address guardian;
        address proposer;
        address listing;
        address items;
        address kek;
        string baseURI;
        uint256 mintFee;
    }

    struct Deployed {
        CharacterNFT nft;
        CharacterCheckpoint checkpoint;
        CharacterFactory factory;
        RulesetRegistry rulesets;
        AhEscrow ahEscrow;
    }

    function run() external virtual returns (Deployed memory d) {
        Config memory c = Config({
            multisig: vm.envAddress("MULTISIG"),
            rotator: vm.envAddress("ROTATOR"),
            guardian: vm.envAddress("GUARDIAN"),
            proposer: vm.envAddress("PROPOSER"),
            listing: vm.envOr("LISTING", address(0)),
            items: vm.envAddress("ITEMS"),
            kek: vm.envAddress("KEK"),
            baseURI: vm.envString("BASE_URI"),
            // Override with MINT_FEE (wei). Default 0.001 ETH for anvil; Chiado uses DeployChiado (1 xDAI).
            mintFee: vm.envOr("MINT_FEE", uint256(0.001 ether))
        });
        vm.startBroadcast();
        d = deploy(c, msg.sender);
        vm.stopBroadcast();
        console.log("CharacterNFT        ", address(d.nft));
        console.log("CharacterCheckpoint ", address(d.checkpoint));
        console.log("CharacterFactory    ", address(d.factory));
        console.log("RulesetRegistry     ", address(d.rulesets));
        console.log("AhEscrow            ", address(d.ahEscrow));
        console.log("mintFee (wei)       ", c.mintFee);
    }

    function _proxy(address impl, bytes memory init) internal returns (address) {
        return address(new ERC1967Proxy(impl, init));
    }

    /// `deployer` is the account executing the calls (temporary admin).
    function deploy(Config memory c, address deployer) public returns (Deployed memory d) {
        d.nft = CharacterNFT(
            _proxy(
                address(new CharacterNFT()),
                abi.encodeCall(CharacterNFT.initialize, (deployer, "Legend of Kek Character", "LOKC", c.baseURI))
            )
        );
        d.checkpoint = CharacterCheckpoint(
            _proxy(
                address(new CharacterCheckpoint()),
                abi.encodeCall(CharacterCheckpoint.initialize, (deployer, address(d.nft), c.rotator, c.guardian))
            )
        );
        d.factory = CharacterFactory(
            _proxy(
                address(new CharacterFactory()),
                abi.encodeCall(CharacterFactory.initialize, (deployer, address(d.nft), address(d.checkpoint), c.mintFee))
            )
        );
        d.rulesets = RulesetRegistry(
            _proxy(address(new RulesetRegistry()), abi.encodeCall(RulesetRegistry.initialize, (deployer, RULESET_MIN_DELAY)))
        );
        // Fee recipient defaults to multisig; buyAsk pays ownerOf(sellerTokenId) on the NFT.
        d.ahEscrow = new AhEscrow(deployer, address(d.nft), payable(c.multisig));

        // Batched redeploy: drop CharacterCheckpoint.vault / KekVault once no live chain needs deposit custody.

        // wiring
        d.nft.setState(address(d.checkpoint));
        d.nft.grantRole(d.nft.MINTER_ROLE(), address(d.factory));
        d.checkpoint.grantRole(d.checkpoint.FACTORY_ROLE(), address(d.factory));
        d.checkpoint.grantRole(d.checkpoint.NFT_ROLE(), address(d.nft));
        d.checkpoint.setRulesets(address(d.rulesets));
        d.checkpoint.setItems(c.items);
        d.rulesets.grantRole(d.rulesets.PROPOSER_ROLE(), c.proposer);
        d.rulesets.grantRole(d.rulesets.EMERGENCY_ROLE(), c.multisig);

        // AhEscrow listing role for the server EOA that opens/cancels asks
        address listing = c.listing == address(0) ? c.rotator : c.listing;
        d.ahEscrow.grantRole(d.ahEscrow.LISTING_ROLE(), listing);

        // Hand over admin to multisig. If multisig == deployer, do NOT renounce
        // (grant+renounce on the same address would leave zero admins).
        bytes32 admin = d.nft.DEFAULT_ADMIN_ROLE();
        if (c.multisig != deployer) {
            d.nft.grantRole(admin, c.multisig);
            d.checkpoint.grantRole(admin, c.multisig);
            d.factory.grantRole(admin, c.multisig);
            d.rulesets.grantRole(admin, c.multisig);
            d.ahEscrow.grantRole(d.ahEscrow.DEFAULT_ADMIN_ROLE(), c.multisig);
            d.nft.renounceRole(admin, deployer);
            d.checkpoint.renounceRole(admin, deployer);
            d.factory.renounceRole(admin, deployer);
            d.rulesets.renounceRole(admin, deployer);
            // Revoke listing before admin — revokeRole requires DEFAULT_ADMIN_ROLE.
            if (listing != deployer) {
                d.ahEscrow.revokeRole(d.ahEscrow.LISTING_ROLE(), deployer);
            }
            d.ahEscrow.revokeRole(d.ahEscrow.DEFAULT_ADMIN_ROLE(), deployer);
        } else if (listing != deployer) {
            // Deployer keeps admin (= multisig); drop temporary LISTING if unused.
            d.ahEscrow.revokeRole(d.ahEscrow.LISTING_ROLE(), deployer);
        }
    }
}
