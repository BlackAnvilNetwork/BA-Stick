// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AhEscrow} from "../src/AhEscrow.sol";
import {GuildVault} from "../src/GuildVault.sol";
import {RulesetRegistry} from "../src/RulesetRegistry.sol";
import {MockOwnerNft} from "./mocks/MockOwnerNft.sol";

/// Guild-vault slice: the 5% fee splits 250/250. Shares move only after the ruleset timelock.
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

    function test_zeroVolumeVaultHoldsZero() public view {
        assertEq(escrow.guildVault().balance, 0);
        assertEq(address(escrow).balance, 0);
        assertEq(escrow.vaultBps(), 250);
        assertEq(escrow.treasuryBps(), 250);
        assertEq(escrow.vaultBps() + escrow.treasuryBps(), escrow.FEE_BPS());
        assertEq(escrow.FEE_BPS(), 500);
    }

    function test_buyAsk_buyerPaysFivePercent_sellerNetsNinetyFive_sharesAreTwoFiftyBps() public {
        _open(LISTING, PRICE);
        uint256 beforeBuyer = buyer.balance;
        uint256 beforeSeller = seller.balance;

        vm.prank(buyer);
        escrow.buyAsk{value: PRICE}(LISTING, BUYER_TOKEN);

        uint256 fee = (PRICE * 500) / 10_000;
        uint256 vaultWei = (PRICE * 250) / 10_000;
        uint256 treasuryWei = (PRICE * 250) / 10_000;
        assertEq(beforeBuyer - buyer.balance, PRICE, "buyer pays the sale price, not a second fee");
        assertEq(seller.balance - beforeSeller, PRICE - fee, "seller nets 95%");
        assertEq(seller.balance - beforeSeller, (PRICE * 9500) / 10_000);
        assertEq(escrow.guildVault().balance, vaultWei, "vault receives 250 bps");
        assertEq(feeTo.balance, treasuryWei, "treasury receives 250 bps");
        assertEq(vaultWei + treasuryWei, fee, "250 + 250 = 500 bps");
        assertEq(address(escrow).balance, 0);
        assertEq(GuildVault(escrow.guildVault()).escrow(), address(escrow));
    }

    function test_quoteFeeShares_floorsLikeQuoteFee() public view {
        (uint256 fee20, uint256 net20) = escrow.quoteFee(20);
        (uint256 vault20, uint256 treasury20) = escrow.quoteFeeShares(20);
        assertEq(fee20, 1);
        assertEq(net20, 19);
        assertEq(vault20, uint256(20 * 250) / 10_000);
        assertEq(vault20, 0);
        assertEq(treasury20, fee20 - vault20, "leftover wei of the 5% stays with the treasury");

        (uint256 vault40, uint256 treasury40) = escrow.quoteFeeShares(40);
        assertEq(vault40, uint256(40 * 250) / 10_000);
        assertEq(treasury40, uint256(40 * 250) / 10_000);
        assertEq(vault40 + treasury40, 2);

        (uint256 fee10k, uint256 net10k) = escrow.quoteFee(10_000);
        (uint256 vault10k, uint256 treasury10k) = escrow.quoteFeeShares(10_000);
        assertEq(fee10k, 500);
        assertEq(net10k, 9_500);
        assertEq(vault10k, 250);
        assertEq(treasury10k, 250);

        (uint256 vault1, uint256 treasury1) = escrow.quoteFeeShares(1);
        assertEq(vault1, 0);
        assertEq(treasury1, 0);
    }

    function test_buyAsk_dustPrice_sellerKeepsPriceWhenFeeFloorsToZero() public {
        _open(LISTING, 19);
        vm.prank(buyer);
        escrow.buyAsk{value: 19}(LISTING, BUYER_TOKEN);
        assertEq(seller.balance, 19);
        assertEq(feeTo.balance, 0);
        assertEq(escrow.guildVault().balance, 0);
    }

    function test_directSend_doesNotFundVault() public {
        address vault = escrow.guildVault();
        vm.prank(buyer);
        vm.expectRevert(GuildVault.NotEscrow.selector);
        (bool ok,) = vault.call{value: 1 ether}("");
        ok;
        assertEq(vault.balance, 0);
    }

    function test_feeShares_cannotChangeWithoutTimelock() public {
        RulesetRegistry rules = new RulesetRegistry();
        assertEq(escrow.SHARE_DELAY(), rules.MIN_DELAY(), "share delay is the ruleset timelock floor");
        assertGe(escrow.SHARE_DELAY(), 1 days);

        vm.prank(buyer);
        vm.expectRevert(AhEscrow.Unauthorized.selector);
        escrow.proposeFeeShares(400, 100);
        assertEq(escrow.vaultBps(), 250);
        assertEq(escrow.treasuryBps(), 250);

        vm.prank(admin);
        vm.expectRevert(AhEscrow.BadShares.selector);
        escrow.proposeFeeShares(400, 150);
        assertEq(escrow.vaultBps(), 250);

        vm.prank(admin);
        escrow.proposeFeeShares(400, 100);
        assertEq(escrow.vaultBps(), 250, "propose is not an immediate setter");
        assertEq(escrow.treasuryBps(), 250);
        (uint256 pendingVault, uint256 pendingTreasury, uint64 readyAt) = escrow.pendingFeeShares();
        assertEq(pendingVault, 400);
        assertEq(pendingTreasury, 100);
        assertEq(readyAt, uint64(block.timestamp) + escrow.SHARE_DELAY());

        vm.prank(admin);
        vm.expectRevert(AhEscrow.TooEarly.selector);
        escrow.executeFeeShares();
        assertEq(escrow.vaultBps(), 250);
        assertEq(escrow.treasuryBps(), 250);

        vm.warp(readyAt - 1);
        vm.prank(admin);
        vm.expectRevert(AhEscrow.TooEarly.selector);
        escrow.executeFeeShares();
        assertEq(escrow.vaultBps(), 250);
        assertEq(escrow.treasuryBps(), 250);

        vm.prank(buyer);
        vm.expectRevert(AhEscrow.Unauthorized.selector);
        escrow.executeFeeShares();

        vm.warp(readyAt);
        vm.prank(admin);
        escrow.executeFeeShares();
        assertEq(escrow.vaultBps(), 400);
        assertEq(escrow.treasuryBps(), 100);
        assertEq(escrow.vaultBps() + escrow.treasuryBps(), escrow.FEE_BPS());
    }

    function test_overwrite_resetsTheTimelock() public {
        vm.prank(admin);
        escrow.proposeFeeShares(400, 100);
        (,, uint64 firstReady) = escrow.pendingFeeShares();

        vm.warp(firstReady - 1);
        vm.prank(admin);
        escrow.proposeFeeShares(350, 150);
        assertEq(escrow.vaultBps(), 250);
        (,, uint64 secondReady) = escrow.pendingFeeShares();
        assertEq(secondReady, uint64(block.timestamp) + escrow.SHARE_DELAY());

        vm.warp(firstReady);
        vm.prank(admin);
        vm.expectRevert(AhEscrow.TooEarly.selector);
        escrow.executeFeeShares();
        assertEq(escrow.vaultBps(), 250);
        assertEq(escrow.treasuryBps(), 250);
    }

    function test_cancel_leavesLiveShares() public {
        vm.prank(admin);
        escrow.proposeFeeShares(0, 500);
        vm.prank(admin);
        escrow.cancelFeeShares();
        assertEq(escrow.vaultBps(), 250);
        assertEq(escrow.treasuryBps(), 250);
        vm.warp(block.timestamp + escrow.SHARE_DELAY());
        vm.prank(admin);
        vm.expectRevert(AhEscrow.NoPendingShares.selector);
        escrow.executeFeeShares();
        assertEq(escrow.vaultBps(), 250);
    }

    function test_setFeeRecipient_doesNotChangeShares() public {
        vm.prank(admin);
        escrow.setFeeRecipient(payable(makeAddr("next")));
        assertEq(escrow.vaultBps(), 250);
        assertEq(escrow.treasuryBps(), 250);
        assertEq(escrow.guildVault().balance, 0);
    }

    function test_shareChange_keepsPlayerFeeAtFivePercent() public {
        vm.prank(admin);
        escrow.proposeFeeShares(400, 100);
        (,, uint64 readyAt) = escrow.pendingFeeShares();
        vm.warp(readyAt);
        vm.prank(admin);
        escrow.executeFeeShares();

        _open(LISTING, PRICE);
        uint256 beforeBuyer = buyer.balance;
        uint256 beforeSeller = seller.balance;
        vm.prank(buyer);
        escrow.buyAsk{value: PRICE}(LISTING, BUYER_TOKEN);

        uint256 fee = (PRICE * escrow.FEE_BPS()) / 10_000;
        assertEq(beforeBuyer - buyer.balance, PRICE);
        assertEq(seller.balance - beforeSeller, PRICE - fee);
        assertEq(escrow.guildVault().balance, (PRICE * 400) / 10_000);
        assertEq(feeTo.balance, (PRICE * 100) / 10_000);
        assertEq(escrow.FEE_BPS(), 500);
    }

    function testFuzz_sharesPartitionTheFivePercentFee(uint96 price) public view {
        price = uint96(bound(price, 1, type(uint96).max));
        (uint256 fee, uint256 net) = escrow.quoteFee(price);
        (uint256 vaultWei, uint256 treasuryWei) = escrow.quoteFeeShares(price);
        assertEq(fee, (uint256(price) * 500) / 10_000);
        assertEq(net, uint256(price) - fee);
        assertEq(vaultWei + treasuryWei, fee);
        uint256 vaultFloor = (uint256(price) * 250) / 10_000;
        assertEq(vaultWei, vaultFloor > fee ? fee : vaultFloor);
    }

    /// A 10,000 wei sale deposits 250. The Mark receives 125. Four wallets share 125, floored.
    function test_payout_tenThousandSale_markAndFourWallets() public {
        _open(LISTING, 10_000);
        vm.prank(buyer);
        escrow.buyAsk{value: 10_000}(LISTING, BUYER_TOKEN);

        GuildVault vault = GuildVault(escrow.guildVault());
        assertEq(address(vault).balance, 250);
        assertEq(vault.payer(), admin);
        assertEq(vault.escrow(), address(escrow));

        address mark = makeAddr("markSafe");
        address[] memory members = new address[](4);
        members[0] = makeAddr("wallet0");
        members[1] = makeAddr("wallet1");
        members[2] = makeAddr("wallet2");
        members[3] = makeAddr("wallet3");
        for (uint256 i; i < members.length; ++i) {
            assertEq(members[i].code.length, 0);
        }

        address[] memory to = new address[](5);
        uint256[] memory amounts = new uint256[](5);
        to[0] = mark;
        amounts[0] = 125;
        for (uint256 i; i < members.length; ++i) {
            to[i + 1] = members[i];
            amounts[i + 1] = 31;
        }

        vm.prank(buyer);
        vm.expectRevert(GuildVault.NotPayer.selector);
        vault.schedule(to, amounts);

        address[] memory tooMuchTo = new address[](1);
        uint256[] memory tooMuch = new uint256[](1);
        tooMuchTo[0] = mark;
        tooMuch[0] = 251;
        vm.prank(admin);
        vm.expectRevert(GuildVault.ExceedsBalance.selector);
        vault.schedule(tooMuchTo, tooMuch);
        assertEq(address(vault).balance, 250);

        vm.prank(admin);
        vault.schedule(to, amounts);
        vm.prank(admin);
        vm.expectRevert(GuildVault.AlreadyScheduled.selector);
        vault.schedule(to, amounts);

        vault.pay();
        assertEq(mark.balance, 125);
        uint256 memberPool;
        for (uint256 i; i < members.length; ++i) {
            assertEq(members[i].balance, 31);
            memberPool += members[i].balance;
        }
        assertEq(memberPool, 124);
        assertEq(address(vault).balance, 1);
        assertEq(vault.scheduledCount(), 0);

        vm.expectRevert(GuildVault.NothingScheduled.selector);
        vault.pay();
    }

    /// One rejecting recipient does not block the others or the next schedule.
    function test_pay_skipsRevertingRecipient_andScheduleCanContinue() public {
        _open(LISTING, 10_000);
        vm.prank(buyer);
        escrow.buyAsk{value: 10_000}(LISTING, BUYER_TOKEN);

        GuildVault vault = GuildVault(escrow.guildVault());
        Rejects rejector = new Rejects();
        address mark = makeAddr("markSafe");

        address[] memory to = new address[](2);
        uint256[] memory amounts = new uint256[](2);
        to[0] = mark;
        amounts[0] = 100;
        to[1] = address(rejector);
        amounts[1] = 150;

        vm.prank(admin);
        vault.schedule(to, amounts);
        vault.pay();

        assertEq(mark.balance, 100);
        assertEq(address(rejector).balance, 0);
        assertEq(vault.scheduledCount(), 0);
        assertEq(vault.claimCount(), 1);
        assertEq(vault.reserved(), 150);
        assertEq(address(vault).balance, 150);

        address[] memory again = new address[](1);
        uint256[] memory againAmt = new uint256[](1);
        again[0] = mark;
        againAmt[0] = 1;
        vm.prank(admin);
        vm.expectRevert(GuildVault.ExceedsBalance.selector);
        vault.schedule(again, againAmt);

        vm.prank(mark);
        vm.expectRevert(GuildVault.NotPayer.selector);
        vault.claim(0);

        vm.prank(address(rejector));
        vm.expectRevert(GuildVault.TransferFailed.selector);
        vault.claim(0);
        assertEq(vault.claimCount(), 1);
        assertEq(vault.reserved(), 150);
    }
}

contract Rejects {
    receive() external payable {
        revert("no");
    }
}
