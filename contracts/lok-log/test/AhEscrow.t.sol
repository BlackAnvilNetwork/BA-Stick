// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AhEscrow} from "../src/AhEscrow.sol";

contract AhEscrowTest is Test {
    AhEscrow escrow;
    address admin = makeAddr("admin");
    address seller = makeAddr("seller");
    address buyer = makeAddr("buyer");
    address proxy = makeAddr("eezProxy");

    uint256 constant LISTING = 7;
    uint256 constant SELLER_TOKEN = 1;
    uint256 constant BUYER_TOKEN = 2;
    uint256 constant ITEM = 111;
    uint256 constant AMOUNT = 3;
    uint256 constant PRICE = 0.02 ether;

    function setUp() public {
        escrow = new AhEscrow(admin);
        vm.deal(buyer, 1 ether);
        vm.deal(proxy, 1 ether);
    }

    function test_buyAsk_paysSeller_andEmits() public {
        vm.prank(admin);
        escrow.openAsk(LISTING, SELLER_TOKEN, payable(seller), ITEM, AMOUNT, PRICE);

        uint256 beforeSeller = seller.balance;
        vm.expectEmit(true, true, true, true);
        emit AhEscrow.AskFilled(LISTING, buyer, BUYER_TOKEN, seller, PRICE, ITEM, AMOUNT);

        vm.prank(buyer);
        escrow.buyAsk{value: PRICE}(LISTING, BUYER_TOKEN);

        assertEq(seller.balance, beforeSeller + PRICE);
        (,,,,, bool open, bool used) = escrow.asks(LISTING);
        assertFalse(open);
        assertTrue(used);
    }

    function test_buyAsk_refundsExcess_toMsgSender() public {
        vm.prank(admin);
        escrow.openAsk(LISTING, SELLER_TOKEN, payable(seller), ITEM, AMOUNT, PRICE);

        uint256 beforeProxy = proxy.balance;
        vm.prank(proxy);
        escrow.buyAsk{value: PRICE + 0.01 ether}(LISTING, BUYER_TOKEN);

        assertEq(seller.balance, PRICE);
        assertEq(proxy.balance, beforeProxy - PRICE);
    }

    function test_buyAsk_rejectsShortValue() public {
        vm.prank(admin);
        escrow.openAsk(LISTING, SELLER_TOKEN, payable(seller), ITEM, AMOUNT, PRICE);

        vm.prank(buyer);
        vm.expectRevert(AhEscrow.WrongPrice.selector);
        escrow.buyAsk{value: PRICE - 1}(LISTING, BUYER_TOKEN);
    }

    function test_cannotDoubleFill() public {
        vm.prank(admin);
        escrow.openAsk(LISTING, SELLER_TOKEN, payable(seller), ITEM, AMOUNT, PRICE);

        vm.prank(buyer);
        escrow.buyAsk{value: PRICE}(LISTING, BUYER_TOKEN);

        vm.prank(buyer);
        vm.expectRevert(AhEscrow.AskClosed.selector);
        escrow.buyAsk{value: PRICE}(LISTING, BUYER_TOKEN);
    }

    function test_cancelAsk() public {
        vm.prank(admin);
        escrow.openAsk(LISTING, SELLER_TOKEN, payable(seller), ITEM, AMOUNT, PRICE);

        vm.prank(admin);
        escrow.cancelAsk(LISTING);

        vm.prank(buyer);
        vm.expectRevert(AhEscrow.AskClosed.selector);
        escrow.buyAsk{value: PRICE}(LISTING, BUYER_TOKEN);
    }

    function test_receive_rejectsNakedEth() public {
        vm.prank(buyer);
        vm.expectRevert(AhEscrow.BadAmount.selector);
        (bool ok,) = address(escrow).call{value: 1 wei}("");
        ok; // silence
    }
}
