// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AhEscrow} from "./AhEscrow.sol";

/// @title MockEezSyncBuy
/// @notice Local stand-in for an EEZ `CrossChainProxy` sync buy.
///         Buyer pays this contract (home / same anvil), which forwards
///         `msg.value` to `AhEscrow.buyAsk` on the game domain in the same
///         transaction. Seller payout is already same-batch inside AhEscrow
///         (`sellerPayout.call{value: price}`). Not a production EEZ bridge —
///         upstream `periphery/Bridge.sol` is test-only too.
contract MockEezSyncBuy {
    AhEscrow public immutable escrow;
    /// @dev Opaque zone / rollup id for local registration tests.
    uint256 public immutable zoneId;

    event SyncBuy(
        address indexed homeBuyer,
        uint256 indexed listingId,
        uint256 buyerTokenId,
        uint256 value,
        uint256 zoneId
    );

    error BadAddress();
    error BadId();

    constructor(AhEscrow escrow_, uint256 zoneId_) {
        if (address(escrow_) == address(0)) revert BadAddress();
        if (zoneId_ == 0) revert BadId();
        escrow = escrow_;
        zoneId = zoneId_;
    }

    /// @notice Pay an ask from the "home" wallet; forwards value to AhEscrow.
    function syncBuy(uint256 listingId, uint256 buyerTokenId) external payable {
        escrow.buyAsk{value: msg.value}(listingId, buyerTokenId);
        emit SyncBuy(msg.sender, listingId, buyerTokenId, msg.value, zoneId);
    }
}
