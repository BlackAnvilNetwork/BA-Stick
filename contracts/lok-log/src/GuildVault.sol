// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title GuildVault
/// @notice Holds the guild share of the AhEscrow fee in native xDAI.
///         This slice accepts that share and does not score epochs, mint a
///         token, or pay guilds. A later payout waits for an anchored root
///         and the one-day challenge delay.
contract GuildVault {
    address public immutable escrow;

    event Received(uint256 amount);

    error NotEscrow();

    constructor(address escrow_) {
        if (escrow_ == address(0)) revert NotEscrow();
        escrow = escrow_;
    }

    /// @dev Only the escrow may fund the vault. There is no withdraw.
    receive() external payable {
        if (msg.sender != escrow) revert NotEscrow();
        emit Received(msg.value);
    }
}
