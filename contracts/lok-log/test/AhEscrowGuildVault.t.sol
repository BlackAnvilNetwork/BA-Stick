// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AhEscrow} from "../src/AhEscrow.sol";
import {RulesetRegistry} from "../src/RulesetRegistry.sol";
import {MockOwnerNft} from "./mocks/MockOwnerNft.sol";

/// Guild-vault slice: the 1% fee is recorded 50/50 and neither share is sent.
contract AhEscrowGuildVaultTest is Test {
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
    uint256 constant AMOUNT = 3;
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
        escrow.openAsk(id, SELLER_TOKEN, ITEM, AMOUNT, price);
    }

    function _attemptApply(address caller) internal {
        vm.prank(caller);
        (bool shares,) = address(escrow).call(abi.encodeWithSignature("setFeeShares(uint256,uint256)", 80, 20));
        assertFalse(shares);
        vm.prank(caller);
        (bool vault,) = address(escrow).call(abi.encodeWithSignature("setVaultFeeBps(uint256)", 80));
        assertFalse(vault);
        vm.prank(caller);
        (bool treasury,) = address(escrow).call(abi.encodeWithSignature("setTreasuryFeeBps(uint256)", 20));
        assertFalse(treasury);
        vm.prank(caller);
        (bool proposed,) = address(escrow).call(abi.encodeWithSignature("proposeFeeShares(uint256,uint256)", 80, 20));
        assertFalse(proposed);
        vm.prank(caller);
        (bool executed,) = address(escrow).call(abi.encodeWithSignature("executeFeeShares()"));
        assertFalse(executed);
        vm.prank(caller);
        (bool released,) = address(escrow).call(abi.encodeWithSignature("releaseFeeShares()"));
        assertFalse(released);
    }

    function test_sharesSumToFeeBps_andStayConstant() public {
        assertEq(escrow.VAULT_FEE_BPS(), 50);
        assertEq(escrow.TREASURY_FEE_BPS(), 50);
        assertEq(escrow.VAULT_FEE_BPS() + escrow.TREASURY_FEE_BPS(), escrow.FEE_BPS());
        assertEq(escrow.FEE_BPS(), 100);
        // Same one-day floor as the ruleset timelock. Not Deploy's 48 hours.
        assertEq(new RulesetRegistry().MIN_DELAY(), 1 days);
        assertTrue(new RulesetRegistry().MIN_DELAY() != 48 hours);
    }

    function test_buyAsk_buyerPaysOnePercent_andNeitherShareIsSent() public {
        _open(LISTING, PRICE);
        uint256 beforeBuyer = buyer.balance;
        uint256 beforeSeller = seller.balance;
        uint256 beforeFee = feeTo.balance;
        (uint256 fee, uint256 net) = escrow.quoteFee(PRICE);
        (uint256 vaultWei, uint256 treasuryWei) = escrow.quoteFeeShares(PRICE);

        vm.prank(buyer);
        escrow.buyAsk{value: PRICE}(LISTING, BUYER_TOKEN);

        assertEq(beforeBuyer - buyer.balance, PRICE, "buyer pays the sale price");
        assertEq(seller.balance - beforeSeller, net, "seller nets price minus the 1% fee");
        assertEq(fee + net, PRICE);
        assertEq(vaultWei, (PRICE * 50) / 10_000);
        assertEq(treasuryWei, (PRICE * 50) / 10_000);
        assertEq(vaultWei + treasuryWei, fee);
        assertEq(feeTo.balance, beforeFee, "treasury share is not sent");
        assertEq(buyer.balance, beforeBuyer - PRICE);
        assertEq(address(escrow).balance, fee, "the 1% fee stays in escrow");
        assertEq(escrow.vaultHeldWei(), vaultWei);
        assertEq(escrow.treasuryHeldWei(), treasuryWei);
        assertEq(escrow.VAULT_FEE_BPS(), 50);
        assertEq(escrow.TREASURY_FEE_BPS(), 50);
    }

    function test_unprivilegedCallerCannotApplyEitherShare() public {
        _open(LISTING, PRICE);
        address stranger = makeAddr("stranger");
        vm.deal(stranger, 1 ether);

        vm.prank(stranger);
        vm.expectRevert(AhEscrow.NotOwner.selector);
        escrow.buyAsk{value: PRICE}(LISTING, BUYER_TOKEN);

        _attemptApply(stranger);
        _attemptApply(buyer);

        vm.prank(buyer);
        escrow.buyAsk{value: PRICE}(LISTING, BUYER_TOKEN);

        _attemptApply(buyer);
        assertEq(escrow.VAULT_FEE_BPS(), 50);
        assertEq(escrow.TREASURY_FEE_BPS(), 50);
        assertEq(feeTo.balance, 0);
        assertEq(stranger.balance, 1 ether);
        assertEq(address(escrow).balance, (PRICE * 100) / 10_000);

        vm.warp(block.timestamp + 1 days);
        _attemptApply(buyer);
        _attemptApply(stranger);
        assertEq(feeTo.balance, 0);
        assertEq(address(escrow).balance, (PRICE * 100) / 10_000);
        assertEq(escrow.VAULT_FEE_BPS(), 50);
        assertEq(escrow.TREASURY_FEE_BPS(), 50);
    }

    function test_adminCannotApplyEitherShareInThisTransaction() public {
        _open(LISTING, PRICE);
        vm.prank(buyer);
        escrow.buyAsk{value: PRICE}(LISTING, BUYER_TOKEN);
        uint256 held = address(escrow).balance;

        vm.prank(admin);
        escrow.setFeeRecipient(payable(makeAddr("next")));
        _attemptApply(admin);

        assertEq(escrow.VAULT_FEE_BPS(), 50);
        assertEq(escrow.TREASURY_FEE_BPS(), 50);
        assertEq(feeTo.balance, 0);
        assertEq(address(escrow).balance, held);

        vm.warp(block.timestamp + 1 days);
        _attemptApply(admin);
        assertEq(address(escrow).balance, held);
        assertEq(feeTo.balance, 0);
        assertEq(escrow.VAULT_FEE_BPS() + escrow.TREASURY_FEE_BPS(), escrow.FEE_BPS());
    }

    function test_quoteFeeShares_floorsLikeQuoteFee_andZeroFeeStaysZero() public view {
        (uint256 fee0, uint256 net0) = escrow.quoteFee(0);
        (uint256 vault0, uint256 treasury0) = escrow.quoteFeeShares(0);
        assertEq(fee0, 0);
        assertEq(net0, 0);
        assertEq(vault0, 0);
        assertEq(treasury0, 0);

        (uint256 fee1,) = escrow.quoteFee(1);
        (uint256 vault1, uint256 treasury1) = escrow.quoteFeeShares(1);
        assertEq(fee1, 0);
        assertEq(vault1, 0);
        assertEq(treasury1, 0);

        (uint256 fee99, uint256 net99) = escrow.quoteFee(99);
        (uint256 vault99, uint256 treasury99) = escrow.quoteFeeShares(99);
        assertEq(fee99, 0);
        assertEq(net99, 99);
        assertEq(vault99, 0);
        assertEq(treasury99, 0);

        (uint256 fee100, uint256 net100) = escrow.quoteFee(100);
        (uint256 vault100, uint256 treasury100) = escrow.quoteFeeShares(100);
        assertEq(fee100, 1);
        assertEq(net100, 99);
        assertEq(vault100, 0);
        assertEq(treasury100, 0);
        assertEq(fee100 - (vault100 + treasury100), 1);

        (uint256 vault200, uint256 treasury200) = escrow.quoteFeeShares(200);
        assertEq(vault200, 1);
        assertEq(treasury200, 1);
        (uint256 fee200,) = escrow.quoteFee(200);
        assertEq(vault200 + treasury200, fee200);

        (uint256 fee300,) = escrow.quoteFee(300);
        (uint256 vault300, uint256 treasury300) = escrow.quoteFeeShares(300);
        assertEq(fee300, 3);
        assertEq(vault300, 1);
        assertEq(treasury300, 1);
        assertEq(fee300 - (vault300 + treasury300), 1);
    }

    function test_buyAsk_zeroFee_sendsNothingAndHoldsNothing() public {
        _open(LISTING, 99);
        vm.prank(buyer);
        escrow.buyAsk{value: 99}(LISTING, BUYER_TOKEN);
        assertEq(seller.balance, 99);
        assertEq(feeTo.balance, 0);
        assertEq(address(escrow).balance, 0);
        assertEq(escrow.vaultHeldWei(), 0);
        assertEq(escrow.treasuryHeldWei(), 0);
    }

    function test_buyAsk_oneWeiFee_isHeldAndNeitherShareIsSent() public {
        _open(LISTING, 100);
        vm.prank(buyer);
        escrow.buyAsk{value: 100}(LISTING, BUYER_TOKEN);
        assertEq(seller.balance, 99);
        assertEq(feeTo.balance, 0);
        assertEq(address(escrow).balance, 1);
        assertEq(escrow.vaultHeldWei(), 0);
        assertEq(escrow.treasuryHeldWei(), 0);
    }

    function testFuzz_sharesFloorInsideTheOnePercentFee(uint256 price) public view {
        price = bound(price, 0, type(uint128).max);
        (uint256 fee, uint256 net) = escrow.quoteFee(price);
        (uint256 vaultWei, uint256 treasuryWei) = escrow.quoteFeeShares(price);
        assertEq(fee, (price * 100) / 10_000);
        assertEq(net, price - fee);
        assertEq(vaultWei, (price * 50) / 10_000);
        assertEq(treasuryWei, (price * 50) / 10_000);
        assertLe(vaultWei + treasuryWei, fee);
        assertLe(fee - (vaultWei + treasuryWei), 1);
        if (fee == 0) {
            assertEq(vaultWei, 0);
            assertEq(treasuryWei, 0);
        }
    }
}
