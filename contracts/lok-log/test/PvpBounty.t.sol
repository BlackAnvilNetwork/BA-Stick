// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PvpBounty} from "../src/PvpBounty.sol";
import {MockOwnerNft} from "./mocks/MockOwnerNft.sol";

contract PvpBountyTest is Test {
    PvpBounty bounty;
    MockOwnerNft nft;
    address admin = makeAddr("admin");
    address operator = makeAddr("operator");
    address guardian = makeAddr("guardian");
    address payer = makeAddr("payer");
    address slayer = makeAddr("slayer");
    address buyer = makeAddr("buyer");

    uint256 constant VICTIM = 1;
    uint256 constant SLAYER = 2;

    function setUp() public {
        nft = new MockOwnerNft();
        nft.setOwner(VICTIM, payer);
        nft.setOwner(SLAYER, slayer);
        bounty = new PvpBounty(address(nft), admin, operator, 60);
        bytes32 guardianRole = bounty.GUARDIAN_ROLE();
        vm.prank(admin);
        bounty.grantRole(guardianRole, guardian);
        vm.deal(payer, 2 ether);
        vm.deal(slayer, 1 ether);
    }

    function _place() internal {
        vm.prank(payer);
        bounty.place{value: 1 ether}(VICTIM);
    }

    function test_cancel_refunds_original_payer_after_transfer() public {
        _place();
        nft.setOwner(VICTIM, buyer);
        uint256 beforePayer = payer.balance;
        vm.prank(buyer);
        bounty.cancel(VICTIM);
        assertEq(payer.balance, beforePayer + 1 ether);
        assertEq(buyer.balance, 0);
        assertFalse(bounty.open(VICTIM));
    }

    function test_cancel_allowed_while_paused() public {
        _place();
        vm.prank(guardian);
        bounty.pause();
        vm.prank(operator);
        bounty.cancel(VICTIM);
        assertEq(payer.balance, 2 ether);
    }

    function test_propose_reverts_when_slayer_moved() public {
        _place();
        nft.setOwner(SLAYER, buyer);
        vm.prank(operator);
        vm.expectRevert(PvpBounty.SlayerMoved.selector);
        bounty.proposeClaim(VICTIM, SLAYER, slayer);
    }

    function test_execute_pays_snapshotted_slayer_not_later_owner() public {
        _place();
        vm.prank(operator);
        bounty.proposeClaim(VICTIM, SLAYER, slayer);
        nft.setOwner(SLAYER, buyer);
        vm.warp(block.timestamp + 60);
        uint256 beforeSlayer = slayer.balance;
        vm.prank(operator);
        bounty.executeClaim(VICTIM);
        assertEq(slayer.balance, beforeSlayer + 1 ether);
        assertEq(buyer.balance, 0);
        assertFalse(bounty.open(VICTIM));
    }

    function test_execute_too_early_and_guardian_veto() public {
        _place();
        vm.prank(operator);
        bounty.proposeClaim(VICTIM, SLAYER, slayer);
        vm.prank(operator);
        vm.expectRevert(PvpBounty.TooEarly.selector);
        bounty.executeClaim(VICTIM);
        vm.prank(guardian);
        bounty.vetoClaim(VICTIM);
        assertTrue(bounty.open(VICTIM));
        assertEq(bounty.payerOf(VICTIM), payer);
    }

    function test_pause_blocks_execute_not_direct_eth() public {
        _place();
        vm.prank(operator);
        bounty.proposeClaim(VICTIM, SLAYER, slayer);
        vm.warp(block.timestamp + 60);
        vm.prank(guardian);
        bounty.pause();
        vm.prank(operator);
        vm.expectRevert();
        bounty.executeClaim(VICTIM);
        (bool ok,) = address(bounty).call{value: 1 ether}("");
        assertFalse(ok);
        assertEq(address(bounty).balance, 1 ether);
    }

    function test_zero_delay_executes_same_block() public {
        PvpBounty fast = new PvpBounty(address(nft), admin, operator, 0);
        vm.prank(payer);
        fast.place{value: 1 ether}(VICTIM);
        vm.startPrank(operator);
        fast.proposeClaim(VICTIM, SLAYER, slayer);
        fast.executeClaim(VICTIM);
        vm.stopPrank();
        assertEq(slayer.balance, 2 ether);
    }
}
