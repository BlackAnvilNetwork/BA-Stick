// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Items} from "../src/Items.sol";
import {ItemIds} from "../src/libraries/ItemIds.sol";
import {IItems} from "../src/interfaces/IItems.sol";

contract ItemsTest is Test {
    Items internal items;
    address internal admin = makeAddr("admin");
    address internal checkpoint = makeAddr("checkpoint");
    address internal registrar = makeAddr("registrar");
    address internal player = makeAddr("player");

    function setUp() public {
        items = new Items(admin, "https://blackanvil.gg/items/");
        vm.startPrank(admin);
        items.grantRole(items.MINTER_ROLE(), checkpoint);
        items.grantRole(items.REGISTRAR_ROLE(), registrar);
        vm.stopPrank();
    }

    function test_registerFungible_stableId_noRedeploy() public {
        vm.prank(registrar);
        uint256 id = items.registerFungible("iron-ore", "iron-ore.json", 0);
        assertEq(id, ItemIds.fungible("iron-ore"));
        assertTrue(items.exists(id));

        // Later catalog row: new slug → new id, same contract.
        vm.prank(registrar);
        uint256 id2 = items.registerFungible("mythril-ore", "mythril-ore.json", 0);
        assertTrue(items.exists(id2));
        assertTrue(id2 != id);
    }

    function test_mintBurn_onlyMinter_andRegistered() public {
        uint256 id = ItemIds.fungible("pale-dust");
        vm.prank(registrar);
        items.registerItem(id, "pale-dust", "pale-dust.json", false, 0);

        vm.prank(player);
        vm.expectRevert();
        items.mint(player, id, 5);

        vm.prank(checkpoint);
        items.mint(player, id, 5);
        assertEq(items.balanceOf(player, id), 5);

        vm.prank(player);
        items.setApprovalForAll(checkpoint, true);
        vm.prank(checkpoint);
        items.burn(player, id, 2);
        assertEq(items.balanceOf(player, id), 3);

        uint256 unknown = ItemIds.fungible("not-registered");
        vm.prank(checkpoint);
        vm.expectRevert(abi.encodeWithSelector(Items.NotRegistered.selector, unknown));
        items.mint(player, unknown, 1);
    }

    function test_burn_requiresApprovalFromOtherAddress() public {
        uint256 id = ItemIds.fungible("pale-dust");
        vm.prank(registrar);
        items.registerItem(id, "pale-dust", "pale-dust.json", false, 0);
        vm.prank(checkpoint);
        items.mint(player, id, 3);

        // Minter cannot burn another wallet's tokens without approval.
        vm.prank(checkpoint);
        vm.expectRevert(Items.NotApproved.selector);
        items.burn(player, id, 1);

        vm.prank(player);
        items.setApprovalForAll(checkpoint, true);
        vm.prank(checkpoint);
        items.burn(player, id, 1);
        assertEq(items.balanceOf(player, id), 2);
    }

    function test_unique_supplyOne() public {
        vm.prank(registrar);
        uint256 id = items.registerUnique("iron-sword", 42, "sword-42.json");
        assertEq(id, ItemIds.unique("iron-sword", 42));

        vm.prank(checkpoint);
        items.mint(player, id, 1);
        assertEq(items.balanceOf(player, id), 1);

        vm.prank(checkpoint);
        vm.expectRevert(abi.encodeWithSelector(Items.SupplyCap.selector, id));
        items.mint(player, id, 1);

        uint256 id2 = ItemIds.unique("iron-sword", 43);
        vm.prank(registrar);
        items.registerItem(id2, "iron-sword", "", true, 1);
        vm.prank(checkpoint);
        vm.expectRevert(Items.UniqueAmount.selector);
        items.mint(player, id2, 2);
    }

    function test_registerItems_batch() public {
        uint256[] memory ids = new uint256[](2);
        string[] memory typeIds = new string[](2);
        string[] memory uris = new string[](2);
        bool[] memory uniques = new bool[](2);
        uint256[] memory caps = new uint256[](2);
        ids[0] = ItemIds.fungible("ashbeam-lumber");
        ids[1] = ItemIds.fungible("linen-cloth");
        typeIds[0] = "ashbeam-lumber";
        typeIds[1] = "linen-cloth";
        uris[0] = "a.json";
        uris[1] = "b.json";
        uniques[0] = false;
        uniques[1] = false;
        caps[0] = 0;
        caps[1] = 0;

        vm.prank(registrar);
        items.registerItems(ids, typeIds, uris, uniques, caps);
        assertTrue(items.exists(ids[0]));
        assertTrue(items.exists(ids[1]));
    }

    function test_iItems_surface() public {
        IItems i = IItems(address(items));
        uint256 id = ItemIds.fungible("potion");
        vm.prank(registrar);
        items.registerFungible("potion", "", 0);
        vm.prank(checkpoint);
        i.mint(player, id, 1);
        assertEq(i.balanceOf(player, id), 1);
        vm.prank(player);
        items.setApprovalForAll(checkpoint, true);
        vm.prank(checkpoint);
        i.burn(player, id, 1);
        assertEq(i.balanceOf(player, id), 0);
    }

    function test_noOpenSetMinter() public {
        // Contrast with MockItems.setMinter (open): strangers cannot grant mint.
        address stranger = makeAddr("stranger");
        vm.prank(stranger);
        try items.grantRole(items.MINTER_ROLE(), stranger) {
            revert("expected unauthorized grantRole");
        } catch {}
        assertFalse(items.hasRole(items.MINTER_ROLE(), stranger));
    }
}
