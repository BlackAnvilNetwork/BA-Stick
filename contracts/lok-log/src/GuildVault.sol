// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title GuildVault
/// @notice Holds the guild share of the AhEscrow fee in native xDAI.
///         The payer schedules one list of addresses and amounts. `pay` sends
///         that list and nothing else. There is no withdraw of an arbitrary
///         recipient and amount. The sum of a schedule cannot exceed the balance.
contract GuildVault {
    struct Line {
        address to;
        uint256 amount;
    }

    address public immutable escrow;
    /// @notice The account that may schedule a payout. `pay` sends only that schedule.
    address public immutable payer;

    Line[] private lines;

    event Received(uint256 amount);
    event Scheduled(uint256 count, uint256 total);
    event Paid(address indexed to, uint256 amount);

    error NotEscrow();
    error NotPayer();
    error BadLine();
    error AlreadyScheduled();
    error NothingScheduled();
    error ExceedsBalance();
    error TransferFailed();

    constructor(address escrow_, address payer_) {
        if (escrow_ == address(0) || payer_ == address(0)) revert NotEscrow();
        escrow = escrow_;
        payer = payer_;
    }

    /// @dev Only the escrow may fund the vault.
    receive() external payable {
        if (msg.sender != escrow) revert NotEscrow();
        emit Received(msg.value);
    }

    function scheduledCount() external view returns (uint256) {
        return lines.length;
    }

    /// @notice Store the payout list. The sum cannot exceed the vault balance.
    ///         A second call reverts until `pay` has sent the current list.
    function schedule(address[] calldata to, uint256[] calldata amounts) external {
        if (msg.sender != payer) revert NotPayer();
        if (lines.length != 0) revert AlreadyScheduled();
        if (to.length == 0 || to.length != amounts.length) revert BadLine();
        uint256 sum;
        for (uint256 i; i < to.length; ++i) {
            if (to[i] == address(0) || amounts[i] == 0) revert BadLine();
            sum += amounts[i];
        }
        if (sum > address(this).balance) revert ExceedsBalance();
        for (uint256 i; i < to.length; ++i) {
            lines.push(Line(to[i], amounts[i]));
        }
        emit Scheduled(to.length, sum);
    }

    /// @notice Send the scheduled amounts to the scheduled addresses. No recipient
    ///         or amount is chosen here.
    function pay() external {
        uint256 n = lines.length;
        if (n == 0) revert NothingScheduled();
        Line[] memory due = new Line[](n);
        for (uint256 i; i < n; ++i) due[i] = lines[i];
        while (lines.length > 0) lines.pop();
        for (uint256 i; i < n; ++i) {
            (bool ok,) = due[i].to.call{value: due[i].amount}("");
            if (!ok) revert TransferFailed();
            emit Paid(due[i].to, due[i].amount);
        }
    }
}
