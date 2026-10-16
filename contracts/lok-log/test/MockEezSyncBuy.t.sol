// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AhEscrow} from "../src/AhEscrow.sol";
import {MockEezSyncBuy} from "../src/MockEezSyncBuy.sol";
import {MockOwnerNft} from "./mocks/MockOwnerNft.sol";

contract MockEezSyncBuyTest is Test {
    AhEscrow escrow;
    MockEezSyncBuy mock;
    MockOwnerNft nft;
    address admin = makeAddr("admin");
    address sellerHome = makeAddr("sellerHome");
    address buyerHome;
    uint256 buyerPk;
    address feeTo = makeAddr("feeTo");

    uint256 constant ZONE = 31337;
    uint256 constant LISTING = 42;
    uint256 constant SELLER_TOKEN = 1;
    uint256 constant BUYER_TOKEN = 2;
    uint256 constant ITEM = 111;
    uint256 constant AMOUNT = 1;
    uint256 constant PRICE = 0.02 ether;

    function setUp() public {
        (buyerHome, buyerPk) = makeAddrAndKey("buyerHome");
        nft = new MockOwnerNft();
        nft.setOwner(SELLER_TOKEN, sellerHome);
        nft.setOwner(BUYER_TOKEN, buyerHome);
        escrow = new AhEscrow(admin, address(nft), payable(feeTo));
        mock = new MockEezSyncBuy(escrow, ZONE);
        vm.deal(buyerHome, 1 ether);
    }

    function test_syncBuy_paysSellerSameBatch_andEmits() public {
        vm.prank(admin);
        escrow.openAsk(LISTING, SELLER_TOKEN, ITEM, AMOUNT, PRICE);

        (uint256 fee, uint256 net) = escrow.quoteFee(PRICE);
        (uint256 vaultWei, uint256 treasuryWei) = escrow.quoteFeeShares(PRICE);
        uint256 beforeSeller = sellerHome.balance;
        vm.expectEmit(true, true, true, true);
        emit AhEscrow.AskFilled(LISTING, address(mock), BUYER_TOKEN, sellerHome, PRICE, fee, ITEM, AMOUNT);

        uint256 deadline = _deadline();
        bytes memory sig = _ownerSig(LISTING);
        vm.prank(buyerHome);
        mock.syncBuy{value: PRICE}(LISTING, BUYER_TOKEN, deadline, sig);

        assertEq(sellerHome.balance, beforeSeller + net);
        assertEq(feeTo.balance, treasuryWei);
        assertEq(escrow.guildVault().balance, vaultWei);
        assertEq(vaultWei + treasuryWei, fee);
        (,,,, bool open, bool used) = escrow.asks(LISTING);
        assertFalse(open);
        assertTrue(used);
        assertEq(address(mock).balance, 0);
    }

    function test_syncBuy_refundsExcess_toBuyer() public {
        vm.prank(admin);
        escrow.openAsk(LISTING, SELLER_TOKEN, ITEM, AMOUNT, PRICE);

        (, uint256 net) = escrow.quoteFee(PRICE);
        uint256 beforeBuyer = buyerHome.balance;
        uint256 deadline = _deadline();
        bytes memory sig = _ownerSig(LISTING);
        vm.prank(buyerHome);
        mock.syncBuy{value: PRICE + 0.01 ether}(LISTING, BUYER_TOKEN, deadline, sig);

        assertEq(sellerHome.balance, net);
        assertEq(address(mock).balance, 0, "excess must not stay on the mock");
        assertEq(buyerHome.balance, beforeBuyer - PRICE);
    }

    function test_syncBuy_rejectsShortValue() public {
        vm.prank(admin);
        escrow.openAsk(LISTING, SELLER_TOKEN, ITEM, AMOUNT, PRICE);

        uint256 deadline = _deadline();
        bytes memory sig = _ownerSig(LISTING);
        vm.prank(buyerHome);
        vm.expectRevert(MockEezSyncBuy.WrongPrice.selector);
        mock.syncBuy{value: PRICE - 1}(LISTING, BUYER_TOKEN, deadline, sig);
    }

    function _deadline() internal view returns (uint256) {
        return block.timestamp + 1 hours;
    }

    function _ownerSig(uint256 listingId) internal view returns (bytes memory) {
        bytes32 structHash =
            keccak256(abi.encode(escrow.BUY_ASK_FOR_TYPEHASH(), listingId, BUYER_TOKEN, address(mock), _deadline()));
        bytes32 domain = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("AhEscrow"),
                keccak256("1"),
                block.chainid,
                address(escrow)
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domain, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(buyerPk, digest);
        return abi.encodePacked(r, s, v);
    }

    function test_zoneId_set() public view {
        assertEq(mock.zoneId(), ZONE);
        assertEq(address(mock.escrow()), address(escrow));
    }
}
