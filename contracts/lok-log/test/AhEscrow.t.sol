// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AhEscrow} from "../src/AhEscrow.sol";
import {MockOwnerNft} from "./mocks/MockOwnerNft.sol";

contract AhEscrowTest is Test {
    AhEscrow escrow;
    MockOwnerNft nft;
    address admin = makeAddr("admin");
    address seller = makeAddr("seller");
    address buyer = makeAddr("buyer");
    address proxy = makeAddr("eezProxy");
    address feeTo = makeAddr("feeTo");
    address newOwner = makeAddr("newOwner");

    uint256 constant LISTING = 7;
    uint256 constant SELLER_TOKEN = 1;
    uint256 constant BUYER_TOKEN = 2;
    uint256 constant ITEM = 111;
    uint256 constant AMOUNT = 3;
    uint256 constant PRICE = 0.02 ether;

    function setUp() public {
        nft = new MockOwnerNft();
        nft.setOwner(SELLER_TOKEN, seller);
        escrow = new AhEscrow(admin, address(nft), payable(feeTo));
        vm.deal(buyer, 1 ether);
        vm.deal(proxy, 1 ether);
    }

    function _open(uint256 id, uint256 price) internal {
        vm.prank(admin);
        escrow.openAsk(id, SELLER_TOKEN, ITEM, AMOUNT, price);
    }

    function test_buyAsk_paysOwnerOf_minusFee_andEmits() public {
        _open(LISTING, PRICE);
        (uint256 fee, uint256 net) = escrow.quoteFee(PRICE);

        uint256 beforeSeller = seller.balance;
        uint256 beforeFee = feeTo.balance;
        vm.expectEmit(true, true, true, true);
        emit AhEscrow.AskFilled(LISTING, buyer, BUYER_TOKEN, seller, PRICE, fee, ITEM, AMOUNT);

        vm.prank(buyer);
        escrow.buyAsk{value: PRICE}(LISTING, BUYER_TOKEN);

        assertEq(seller.balance, beforeSeller + net);
        assertEq(feeTo.balance, beforeFee + fee);
        assertEq(fee + net, PRICE);
        (,,,, bool open, bool used) = escrow.asks(LISTING);
        assertFalse(open);
        assertTrue(used);
    }

    function test_buyAsk_paysCurrentOwner_afterTransfer() public {
        _open(LISTING, PRICE);
        nft.setOwner(SELLER_TOKEN, newOwner);
        (uint256 fee, uint256 net) = escrow.quoteFee(PRICE);

        vm.prank(buyer);
        escrow.buyAsk{value: PRICE}(LISTING, BUYER_TOKEN);

        assertEq(newOwner.balance, net);
        assertEq(seller.balance, 0);
        assertEq(feeTo.balance, fee);
    }

    function test_buyAsk_refundsExcess_toMsgSender() public {
        _open(LISTING, PRICE);
        (, uint256 net) = escrow.quoteFee(PRICE);

        uint256 beforeProxy = proxy.balance;
        vm.prank(proxy);
        escrow.buyAsk{value: PRICE + 0.01 ether}(LISTING, BUYER_TOKEN);

        assertEq(seller.balance, net);
        assertEq(proxy.balance, beforeProxy - PRICE);
    }

    function test_buyAsk_rejectsShortValue() public {
        _open(LISTING, PRICE);
        vm.prank(buyer);
        vm.expectRevert(AhEscrow.WrongPrice.selector);
        escrow.buyAsk{value: PRICE - 1}(LISTING, BUYER_TOKEN);
    }

    function test_cannotDoubleFill() public {
        _open(LISTING, PRICE);
        vm.prank(buyer);
        escrow.buyAsk{value: PRICE}(LISTING, BUYER_TOKEN);
        vm.prank(buyer);
        vm.expectRevert(AhEscrow.AskClosed.selector);
        escrow.buyAsk{value: PRICE}(LISTING, BUYER_TOKEN);
    }

    function test_cancelAsk() public {
        _open(LISTING, PRICE);
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

    function test_setFeeRecipient() public {
        address payable next = payable(makeAddr("nextFee"));
        vm.prank(admin);
        escrow.setFeeRecipient(next);
        assertEq(escrow.feeRecipient(), next);
    }

    function test_quoteFee_roundingFloor() public {
        // fee = price / 100 (floor); sellerNet = price - fee.
        (uint256 f1, uint256 n1) = escrow.quoteFee(1);
        assertEq(f1, 0);
        assertEq(n1, 1);

        (uint256 f99, uint256 n99) = escrow.quoteFee(99);
        assertEq(f99, 0);
        assertEq(n99, 99);

        (uint256 f100, uint256 n100) = escrow.quoteFee(100);
        assertEq(f100, 1);
        assertEq(n100, 99);

        (uint256 f101, uint256 n101) = escrow.quoteFee(101);
        assertEq(f101, 1);
        assertEq(n101, 100);

        (uint256 f199, uint256 n199) = escrow.quoteFee(199);
        assertEq(f199, 1);
        assertEq(n199, 198);

        (uint256 f200, uint256 n200) = escrow.quoteFee(200);
        assertEq(f200, 2);
        assertEq(n200, 198);
    }

    function testFuzz_quoteFee_partitionsPrice(uint256 price) public view {
        price = bound(price, 1, type(uint128).max);
        (uint256 fee, uint256 net) = escrow.quoteFee(price);
        assertEq(fee + net, price);
        assertEq(fee, (price * 100) / 10_000);
    }

    function test_buyAsk_rounding_dustPrice() public {
        _open(LISTING, 99);
        vm.deal(buyer, 1 ether);
        vm.prank(buyer);
        escrow.buyAsk{value: 99}(LISTING, BUYER_TOKEN);
        assertEq(seller.balance, 99);
        assertEq(feeTo.balance, 0);
    }
}
