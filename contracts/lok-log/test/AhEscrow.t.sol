// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
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
    address guardian = makeAddr("guardian");

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
        bytes32 guardianRole = escrow.GUARDIAN_ROLE();
        vm.prank(admin);
        escrow.grantRole(guardianRole, guardian);
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
        (uint256 vaultWei, uint256 treasuryWei) = escrow.quoteFeeShares(PRICE);

        uint256 beforeSeller = seller.balance;
        uint256 beforeFee = feeTo.balance;
        vm.expectEmit(true, true, true, true);
        emit AhEscrow.AskFilled(LISTING, buyer, BUYER_TOKEN, seller, PRICE, fee, ITEM, AMOUNT);

        vm.prank(buyer);
        escrow.buyAsk{value: PRICE}(LISTING, BUYER_TOKEN);

        assertEq(seller.balance, beforeSeller + net);
        assertEq(feeTo.balance, beforeFee + treasuryWei);
        assertEq(escrow.guildVault().balance, vaultWei);
        assertEq(vaultWei + treasuryWei, fee);
        assertEq(fee + net, PRICE);
        (,,,, bool open, bool used) = escrow.asks(LISTING);
        assertFalse(open);
        assertTrue(used);
    }

    function test_buyAsk_paysCurrentOwner_afterTransfer() public {
        _open(LISTING, PRICE);
        nft.setOwner(SELLER_TOKEN, newOwner);
        (uint256 fee, uint256 net) = escrow.quoteFee(PRICE);
        (uint256 vaultWei, uint256 treasuryWei) = escrow.quoteFeeShares(PRICE);

        vm.prank(buyer);
        escrow.buyAsk{value: PRICE}(LISTING, BUYER_TOKEN);

        assertEq(newOwner.balance, net);
        assertEq(seller.balance, 0);
        assertEq(feeTo.balance, treasuryWei);
        assertEq(escrow.guildVault().balance, vaultWei);
        assertEq(vaultWei + treasuryWei, fee);
    }

    function test_buyAsk_refundsExcess_toMsgSender() public {
        _open(LISTING, PRICE);
        (, uint256 net) = escrow.quoteFee(PRICE);

        uint256 beforeBuyer = buyer.balance;
        vm.prank(buyer);
        escrow.buyAsk{value: PRICE + 0.01 ether}(LISTING, BUYER_TOKEN);

        assertEq(seller.balance, net);
        assertEq(buyer.balance, beforeBuyer - PRICE);
    }

    function test_buyAsk_rejectsCallerWhoDoesNotOwnBuyerToken() public {
        _open(LISTING, PRICE);
        vm.prank(proxy);
        vm.expectRevert(AhEscrow.NotOwner.selector);
        escrow.buyAsk{value: PRICE}(LISTING, BUYER_TOKEN);
    }

    function test_buyAskFor_paysWhenOwnerSignsRelayer() public {
        (, uint256 pk) = makeAddrAndKey("signedBuyer");
        nft.setOwner(BUYER_TOKEN, vm.addr(pk));
        _open(LISTING, PRICE);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _buyAskForSig(pk, LISTING, BUYER_TOKEN, proxy, deadline);
        (, uint256 net) = escrow.quoteFee(PRICE);
        uint256 beforeProxy = proxy.balance;

        vm.prank(proxy);
        escrow.buyAskFor{value: PRICE + 0.01 ether}(LISTING, BUYER_TOKEN, deadline, sig);

        assertEq(seller.balance, net);
        assertEq(proxy.balance, beforeProxy - PRICE);
        (,,,, bool open,) = escrow.asks(LISTING);
        assertFalse(open);
    }

    function test_buyAskFor_rejectsWrongRelayer_andExpired() public {
        (, uint256 pk) = makeAddrAndKey("signedBuyer");
        nft.setOwner(BUYER_TOKEN, vm.addr(pk));
        _open(LISTING, PRICE);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _buyAskForSig(pk, LISTING, BUYER_TOKEN, proxy, deadline);

        vm.prank(buyer);
        vm.expectRevert(AhEscrow.BadSignature.selector);
        escrow.buyAskFor{value: PRICE}(LISTING, BUYER_TOKEN, deadline, sig);

        vm.warp(deadline + 1);
        vm.prank(proxy);
        vm.expectRevert(AhEscrow.Expired.selector);
        escrow.buyAskFor{value: PRICE}(LISTING, BUYER_TOKEN, deadline, sig);
    }

    function _buyAskForSig(uint256 pk, uint256 listingId, uint256 buyerTokenId, address relayer, uint256 deadline)
        internal
        view
        returns (bytes memory)
    {
        bytes32 structHash =
            keccak256(abi.encode(escrow.BUY_ASK_FOR_TYPEHASH(), listingId, buyerTokenId, relayer, deadline));
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
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function test_buyAsk_rejectsShortValue() public {
        _open(LISTING, PRICE);
        vm.prank(buyer);
        vm.expectRevert(AhEscrow.WrongPrice.selector);
        escrow.buyAsk{value: PRICE - 1}(LISTING, BUYER_TOKEN);
    }

    /// L-4: unminted buyerTokenId must revert (ownerOf missing).
    function test_buyAsk_rejectsMissingBuyerToken() public {
        _open(LISTING, PRICE);
        vm.prank(buyer);
        vm.expectRevert(MockOwnerNft.MissingOwner.selector);
        escrow.buyAsk{value: PRICE}(LISTING, 999);
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

    function test_cancelAsks_batch() public {
        _open(LISTING, PRICE);
        _open(LISTING + 1, PRICE);
        uint256[] memory ids = new uint256[](2);
        ids[0] = LISTING;
        ids[1] = LISTING + 1;
        vm.prank(admin);
        escrow.cancelAsks(ids);
        (,,,, bool open0,) = escrow.asks(LISTING);
        (,,,, bool open1,) = escrow.asks(LISTING + 1);
        assertFalse(open0);
        assertFalse(open1);
    }

    function test_pause_blocksOpenAskAndBuyAsk() public {
        _open(LISTING, PRICE);
        vm.prank(guardian);
        escrow.pause();

        vm.prank(admin);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        escrow.openAsk(LISTING + 1, SELLER_TOKEN, ITEM, AMOUNT, PRICE);

        vm.prank(buyer);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        escrow.buyAsk{value: PRICE}(LISTING, BUYER_TOKEN);

        // Cancel still works while paused.
        vm.prank(admin);
        escrow.cancelAsk(LISTING);

        vm.prank(admin);
        escrow.unpause();
        _open(LISTING + 2, PRICE);
        vm.prank(buyer);
        escrow.buyAsk{value: PRICE}(LISTING + 2, BUYER_TOKEN);
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
        // fee = price * 500 / 10000 (floor); sellerNet = price - fee.
        (uint256 f1, uint256 n1) = escrow.quoteFee(1);
        assertEq(f1, 0);
        assertEq(n1, 1);

        (uint256 f19, uint256 n19) = escrow.quoteFee(19);
        assertEq(f19, 0);
        assertEq(n19, 19);

        (uint256 f20, uint256 n20) = escrow.quoteFee(20);
        assertEq(f20, 1);
        assertEq(n20, 19);

        (uint256 f21, uint256 n21) = escrow.quoteFee(21);
        assertEq(f21, 1);
        assertEq(n21, 20);

        (uint256 f39, uint256 n39) = escrow.quoteFee(39);
        assertEq(f39, 1);
        assertEq(n39, 38);

        (uint256 f40, uint256 n40) = escrow.quoteFee(40);
        assertEq(f40, 2);
        assertEq(n40, 38);
    }

    function testFuzz_quoteFee_partitionsPrice(uint256 price) public view {
        price = bound(price, 1, type(uint128).max);
        (uint256 fee, uint256 net) = escrow.quoteFee(price);
        assertEq(fee + net, price);
        assertEq(fee, (price * 500) / 10_000);
    }

    function test_buyAsk_rounding_dustPrice() public {
        _open(LISTING, 19);
        vm.deal(buyer, 1 ether);
        vm.prank(buyer);
        escrow.buyAsk{value: 19}(LISTING, BUYER_TOKEN);
        assertEq(seller.balance, 19);
        assertEq(feeTo.balance, 0);
    }
}
