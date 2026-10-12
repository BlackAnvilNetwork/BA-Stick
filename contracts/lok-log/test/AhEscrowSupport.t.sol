// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AhEscrow} from "../src/AhEscrow.sol";

/// Seller payout that tries to re-enter buyAsk while being paid.
contract ReenterPayout {
    AhEscrow public escrow;
    uint256 public target;
    constructor(AhEscrow e) { escrow = e; }
    function arm(uint256 id) external { target = id; }
    receive() external payable {
        if (target != 0) {
            uint256 id = target;
            target = 0;
            escrow.buyAsk{value: msg.value}(id, 99);
        }
    }
}

/// Support review of 312fa29. Tests marked SUPPORT-FAIL encode the behaviour the
/// review asks for and fail on 312fa29; the others pin behaviour that is correct.
contract AhEscrowSupportTest is Test {
    AhEscrow escrow;
    address admin = makeAddr("admin");
    address seller = makeAddr("seller");
    address buyer = makeAddr("buyer");

    uint256 constant LISTING = 7;
    uint256 constant SELLER_TOKEN = 1;
    uint256 constant BUYER_TOKEN = 2;
    uint256 constant ITEM = 111;
    uint256 constant PRICE = 0.02 ether;

    function setUp() public {
        escrow = new AhEscrow(admin);
        vm.deal(buyer, 10 ether);
    }

    function _open(uint256 id, address payout, uint256 price) internal {
        vm.prank(admin);
        escrow.openAsk(id, SELLER_TOKEN, payable(payout), ITEM, 1, price);
    }

    /// Filled listing ids are single-use and cannot be reopened.
    function test_filledListingIdCannotBeReopened() public {
        _open(LISTING, seller, PRICE);
        vm.prank(buyer);
        escrow.buyAsk{value: PRICE}(LISTING, BUYER_TOKEN);
        vm.prank(admin);
        vm.expectRevert(AhEscrow.AskExists.selector);
        escrow.openAsk(LISTING, SELLER_TOKEN, payable(seller), ITEM + 1, 5, 1 wei);
    }

    /// buyAsk rejects the seller's own character token as buyer.
    function test_buyAskRejectsSellerTokenAsBuyer() public {
        _open(LISTING, seller, PRICE);
        vm.prank(buyer);
        vm.expectRevert(AhEscrow.BadId.selector);
        escrow.buyAsk{value: PRICE}(LISTING, SELLER_TOKEN);
    }

    /// Correct today: seller payout re-entering buyAsk is blocked by the lock.
    function test_reentrantPayoutCannotDoubleFill() public {
        ReenterPayout evil = new ReenterPayout(escrow);
        _open(LISTING, address(evil), PRICE);
        _open(LISTING + 1, seller, PRICE);
        evil.arm(LISTING + 1);
        vm.prank(buyer);
        vm.expectRevert(AhEscrow.TransferFailed.selector);
        escrow.buyAsk{value: PRICE}(LISTING, BUYER_TOKEN);
        (,,,,, bool open) = escrow.asks(LISTING + 1);
        assertTrue(open);
    }

    /// Correct today: only LISTING_ROLE can open/cancel.
    function test_strangerCannotOpenOrCancel() public {
        vm.prank(buyer);
        vm.expectRevert(AhEscrow.Unauthorized.selector);
        escrow.openAsk(LISTING, SELLER_TOKEN, payable(buyer), ITEM, 1, 1);
        _open(LISTING, seller, PRICE);
        vm.prank(buyer);
        vm.expectRevert(AhEscrow.Unauthorized.selector);
        escrow.cancelAsk(LISTING);
    }

    /// Correct today: cancel then buy reverts, so an on-chain cancel that lands first is safe.
    function test_cancelBeforeBuyReverts() public {
        _open(LISTING, seller, PRICE);
        vm.prank(admin);
        escrow.cancelAsk(LISTING);
        vm.prank(buyer);
        vm.expectRevert(AhEscrow.AskClosed.selector);
        escrow.buyAsk{value: PRICE}(LISTING, BUYER_TOKEN);
    }

    /// Fuzz: seller always receives exactly priceWei; buyer keeps the excess.
    function testFuzz_excessRefund(uint96 extra) public {
        _open(LISTING, seller, PRICE);
        uint256 v = PRICE + uint256(extra) % 1 ether;
        uint256 before = buyer.balance;
        vm.prank(buyer);
        escrow.buyAsk{value: v}(LISTING, BUYER_TOKEN);
        assertEq(seller.balance, PRICE);
        assertEq(buyer.balance, before - PRICE);
        assertEq(address(escrow).balance, 0);
    }
}
