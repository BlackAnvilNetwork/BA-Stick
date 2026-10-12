// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AhEscrow} from "../src/AhEscrow.sol";
import {MockEezSyncBuy} from "../src/MockEezSyncBuy.sol";

contract MockEezSyncBuyTest is Test {
    AhEscrow escrow;
    MockEezSyncBuy mock;
    address admin = makeAddr("admin");
    address sellerHome = makeAddr("sellerHome");
    address buyerHome = makeAddr("buyerHome");

    uint256 constant ZONE = 31337;
    uint256 constant LISTING = 42;
    uint256 constant SELLER_TOKEN = 1;
    uint256 constant BUYER_TOKEN = 2;
    uint256 constant ITEM = 111;
    uint256 constant AMOUNT = 1;
    uint256 constant PRICE = 0.02 ether;

    function setUp() public {
        escrow = new AhEscrow(admin);
        mock = new MockEezSyncBuy(escrow, ZONE);
        vm.deal(buyerHome, 1 ether);
    }

    function test_syncBuy_paysSellerSameBatch_andEmits() public {
        vm.prank(admin);
        escrow.openAsk(LISTING, SELLER_TOKEN, payable(sellerHome), ITEM, AMOUNT, PRICE);

        uint256 beforeSeller = sellerHome.balance;
        vm.expectEmit(true, true, true, true);
        emit AhEscrow.AskFilled(LISTING, address(mock), BUYER_TOKEN, sellerHome, PRICE, ITEM, AMOUNT);

        vm.prank(buyerHome);
        mock.syncBuy{value: PRICE}(LISTING, BUYER_TOKEN);

        assertEq(sellerHome.balance, beforeSeller + PRICE);
        (,,,,, bool open, bool used) = escrow.asks(LISTING);
        assertFalse(open);
        assertTrue(used);
        assertEq(address(mock).balance, 0);
    }

    function test_syncBuy_refundsExcess_toBuyer() public {
        vm.prank(admin);
        escrow.openAsk(LISTING, SELLER_TOKEN, payable(sellerHome), ITEM, AMOUNT, PRICE);

        uint256 beforeBuyer = buyerHome.balance;
        vm.prank(buyerHome);
        mock.syncBuy{value: PRICE + 0.01 ether}(LISTING, BUYER_TOKEN);

        assertEq(sellerHome.balance, PRICE);
        assertEq(address(mock).balance, 0, "excess must not stay on the mock");
        assertEq(buyerHome.balance, beforeBuyer - PRICE);
    }

    function test_syncBuy_rejectsShortValue() public {
        vm.prank(admin);
        escrow.openAsk(LISTING, SELLER_TOKEN, payable(sellerHome), ITEM, AMOUNT, PRICE);

        vm.prank(buyerHome);
        vm.expectRevert(MockEezSyncBuy.WrongPrice.selector);
        mock.syncBuy{value: PRICE - 1}(LISTING, BUYER_TOKEN);
    }

    function test_zoneId_set() public view {
        assertEq(mock.zoneId(), ZONE);
        assertEq(address(mock.escrow()), address(escrow));
    }
}
