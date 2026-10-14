// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AhEscrow} from "../src/AhEscrow.sol";
import {MockOwnerNft} from "./mocks/MockOwnerNft.sol";

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

/// Support review of 312fa29 — updated for ownerOf payout + 1% fee.
contract AhEscrowSupportTest is Test {
    AhEscrow escrow;
    MockOwnerNft nft;
    address admin = makeAddr("admin");
    address seller = makeAddr("seller");
    address buyer = makeAddr("buyer");
    address feeTo = makeAddr("feeTo");

    uint256 constant LISTING = 7;
    uint256 constant SELLER_TOKEN = 1;
    uint256 constant BUYER_TOKEN = 2;
    uint256 constant ITEM = 111;
    uint256 constant PRICE = 0.02 ether;

    function setUp() public {
        nft = new MockOwnerNft();
        nft.setOwner(SELLER_TOKEN, seller);
        nft.setOwner(BUYER_TOKEN, buyer);
        escrow = new AhEscrow(admin, address(nft), payable(feeTo));
        vm.deal(buyer, 10 ether);
    }

    function _open(uint256 id, uint256 price) internal {
        vm.prank(admin);
        escrow.openAsk(id, SELLER_TOKEN, ITEM, 1, price);
    }

    /// Filled listing ids are single-use and cannot be reopened.
    function test_filledListingIdCannotBeReopened() public {
        _open(LISTING, PRICE);
        vm.prank(buyer);
        escrow.buyAsk{value: PRICE}(LISTING, BUYER_TOKEN);
        vm.prank(admin);
        vm.expectRevert(AhEscrow.AskExists.selector);
        escrow.openAsk(LISTING, SELLER_TOKEN, ITEM + 1, 5, 1 wei);
    }

    /// buyAsk rejects the seller's own character token as buyer, even when the caller owns it.
    function test_buyAskRejectsSellerTokenAsBuyer() public {
        _open(LISTING, PRICE);
        nft.setOwner(SELLER_TOKEN, buyer);
        vm.prank(buyer);
        vm.expectRevert(AhEscrow.BadId.selector);
        escrow.buyAsk{value: PRICE}(LISTING, SELLER_TOKEN);
    }

    /// Seller (ownerOf) payout re-entering buyAsk is blocked by the lock.
    function test_reentrantPayoutCannotDoubleFill() public {
        ReenterPayout evil = new ReenterPayout(escrow);
        nft.setOwner(SELLER_TOKEN, address(evil));
        nft.setOwner(99, buyer); // ReenterPayout uses buyerTokenId 99
        _open(LISTING, PRICE);
        _open(LISTING + 1, PRICE);
        evil.arm(LISTING + 1);
        vm.prank(buyer);
        vm.expectRevert(AhEscrow.TransferFailed.selector);
        escrow.buyAsk{value: PRICE}(LISTING, BUYER_TOKEN);
        (,,,, bool open,) = escrow.asks(LISTING + 1);
        assertTrue(open);
    }

    /// Only LISTING_ROLE can open/cancel.
    function test_strangerCannotOpenOrCancel() public {
        vm.prank(buyer);
        vm.expectRevert(AhEscrow.Unauthorized.selector);
        escrow.openAsk(LISTING, SELLER_TOKEN, ITEM, 1, 1);
        _open(LISTING, PRICE);
        vm.prank(buyer);
        vm.expectRevert(AhEscrow.Unauthorized.selector);
        escrow.cancelAsk(LISTING);
    }

    /// Cancel then buy reverts, so an on-chain cancel that lands first is safe.
    function test_cancelBeforeBuyReverts() public {
        _open(LISTING, PRICE);
        vm.prank(admin);
        escrow.cancelAsk(LISTING);
        vm.prank(buyer);
        vm.expectRevert(AhEscrow.AskClosed.selector);
        escrow.buyAsk{value: PRICE}(LISTING, BUYER_TOKEN);
    }

    /// Fuzz: fee + sellerNet == price; buyer excess refunded; escrow empty.
    function testFuzz_excessRefund(uint96 extra) public {
        _open(LISTING, PRICE);
        uint256 v = PRICE + uint256(extra) % 1 ether;
        uint256 before = buyer.balance;
        (uint256 fee, uint256 net) = escrow.quoteFee(PRICE);
        vm.prank(buyer);
        escrow.buyAsk{value: v}(LISTING, BUYER_TOKEN);
        assertEq(seller.balance, net);
        assertEq(feeTo.balance, fee);
        assertEq(buyer.balance, before - PRICE);
        assertEq(address(escrow).balance, 0);
    }
}
