// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Items} from "../src/Items.sol";
import {ItemIds} from "../src/libraries/ItemIds.sol";

/// Deploy the access-controlled Items ERC-1155 (no MockItems).
/// Does not call checkpoint.setItems — Safe does that after character-stack deploy.
///
///   forge script script/DeployItems.s.sol:DeployItems --rpc-url $RPC --sig "run()"
///   Add `--broadcast` only with explicit go-ahead.
///
/// Env:
///   ADMIN          Safe multisig (DEFAULT_ADMIN + REGISTRAR after handoff)
///   ITEMS_BASE_URI optional, default https://legendofkek.com/items/
///   CHECKPOINT     optional — if set, grant MINTER_ROLE
///   ITEMS_SEED_SLUGS optional comma-separated catalog slugs to registerFungible
contract DeployItems is Script {
    error BadConfig(string reason);

    function run() external returns (Items items) {
        address admin = vm.envAddress("ADMIN");
        if (admin == address(0)) revert BadConfig("ADMIN=0");
        string memory baseURI = vm.envOr("ITEMS_BASE_URI", string("https://legendofkek.com/items/"));
        address checkpoint = vm.envOr("CHECKPOINT", address(0));
        string memory seed = vm.envOr("ITEMS_SEED_SLUGS", string(""));

        vm.startBroadcast();
        // Temporary admin = deployer so we can seed + grant minter, then hand over.
        items = new Items(msg.sender, baseURI);

        if (checkpoint != address(0)) {
            items.grantRole(items.MINTER_ROLE(), checkpoint);
        }
        if (bytes(seed).length > 0) {
            _seedFungibles(items, seed);
        }

        if (admin != msg.sender) {
            items.grantRole(items.DEFAULT_ADMIN_ROLE(), admin);
            items.grantRole(items.REGISTRAR_ROLE(), admin);
            items.renounceRole(items.REGISTRAR_ROLE(), msg.sender);
            items.renounceRole(items.DEFAULT_ADMIN_ROLE(), msg.sender);
        }
        vm.stopBroadcast();

        console.log("Items                ", address(items));
        console.log("admin                ", admin);
        console.log("checkpoint (minter)  ", checkpoint);
        console.log("pale-dust fungibleId ", ItemIds.fungible("pale-dust"));
        console.log("Next: Safe registerFungible / checkpoint.setItems(items).");
    }

    function _seedFungibles(Items items, string memory csv) internal {
        bytes memory b = bytes(csv);
        uint256 start = 0;
        for (uint256 i = 0; i <= b.length; i++) {
            if (i == b.length || b[i] == ",") {
                if (i > start) {
                    string memory slug = _slice(b, start, i);
                    items.registerFungible(slug, string.concat(slug, ".json"), 0);
                    console.log("seeded", slug);
                }
                start = i + 1;
            }
        }
    }

    function _slice(bytes memory b, uint256 start, uint256 end) internal pure returns (string memory) {
        bytes memory out = new bytes(end - start);
        for (uint256 i = start; i < end; i++) {
            out[i - start] = b[i];
        }
        return string(out);
    }
}
