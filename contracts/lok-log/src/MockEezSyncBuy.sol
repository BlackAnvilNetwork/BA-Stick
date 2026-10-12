// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AhEscrow} from "./AhEscrow.sol";

/// @title MockEezSyncBuy
/// @notice Local stand-in for an EEZ `CrossChainProxy` sync buy.
///         Buyer pays this contract (home / same anvil), which forwards the
///         ask price to `AhEscrow.buyAsk` and refunds any excess to the sender
///         in the same transaction. Seller payout is already same-batch inside
///         AhEscrow. Not a production EEZ bridge.
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
    error WrongPrice();
    error AskClosed();
    error TransferFailed();

    constructor(AhEscrow escrow_, uint256 zoneId_) {
        if (address(escrow_) == address(0)) revert BadAddress();
        if (zoneId_ == 0) revert BadId();
        escrow = escrow_;
        zoneId = zoneId_;
    }

    /// @notice Pay an ask from the "home" wallet; forwards exact price, refunds excess.
    function syncBuy(uint256 listingId, uint256 buyerTokenId) external payable {
        (,,, uint256 priceWei, bool open,) = escrow.asks(listingId);
        if (!open) revert AskClosed();
        if (msg.value < priceWei) revert WrongPrice();

        uint256 excess = msg.value - priceWei;
        escrow.buyAsk{value: priceWei}(listingId, buyerTokenId);

        if (excess > 0) {
            (bool refunded,) = payable(msg.sender).call{value: excess}("");
            if (!refunded) revert TransferFailed();
        }

        emit SyncBuy(msg.sender, listingId, buyerTokenId, priceWei, zoneId);
    }

    /// @dev Reject naked ETH; payment must go through syncBuy.
    receive() external payable {
        revert WrongPrice();
    }
}
