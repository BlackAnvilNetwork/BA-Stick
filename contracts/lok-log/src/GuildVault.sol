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
    /// @dev Recipients that rejected `pay`. They do not keep the schedule locked.
    Line[] private claims;
    bool private paying;

    event Received(uint256 amount);
    event Scheduled(uint256 count, uint256 total);
    event Paid(address indexed to, uint256 amount);
    event PaySkipped(address indexed to, uint256 amount);

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

    function claimCount() external view returns (uint256) {
        return claims.length;
    }

    /// @notice Wei still owed to recipients that rejected `pay`.
    function reserved() public view returns (uint256 sum) {
        for (uint256 i; i < claims.length; ++i) sum += claims[i].amount;
    }

    /// @notice Store the payout list. The sum cannot exceed the balance minus
    ///         outstanding claims. A second call reverts until `pay` clears this list.
    ///         A skipped recipient does not keep this list locked.
    function schedule(address[] calldata to, uint256[] calldata amounts) external {
        if (paying) revert AlreadyScheduled();
        if (msg.sender != payer) revert NotPayer();
        if (lines.length != 0) revert AlreadyScheduled();
        if (to.length == 0 || to.length != amounts.length) revert BadLine();
        uint256 sum;
        for (uint256 i; i < to.length; ++i) {
            if (to[i] == address(0) || amounts[i] == 0) revert BadLine();
            sum += amounts[i];
        }
        uint256 freeBalance = address(this).balance - reserved();
        if (sum > freeBalance) revert ExceedsBalance();
        for (uint256 i; i < to.length; ++i) {
            lines.push(Line(to[i], amounts[i]));
        }
        emit Scheduled(to.length, sum);
    }

    /// @notice Send the scheduled amounts. A recipient that rejects the transfer
    ///         is skipped and may `claim` later. The others are paid. The schedule
    ///         lock clears either way.
    function pay() external {
        if (paying) revert AlreadyScheduled();
        uint256 n = lines.length;
        if (n == 0) revert NothingScheduled();
        paying = true;
        Line[] memory due = new Line[](n);
        for (uint256 i; i < n; ++i) due[i] = lines[i];
        while (lines.length > 0) lines.pop();
        for (uint256 i; i < n; ++i) {
            (bool ok,) = due[i].to.call{value: due[i].amount}("");
            if (ok) emit Paid(due[i].to, due[i].amount);
            else {
                claims.push(due[i]);
                emit PaySkipped(due[i].to, due[i].amount);
            }
        }
        paying = false;
    }

    /// @notice Pull one skipped payment. Only that recipient can call it.
    ///         A revert leaves the claim in place and does not touch the others.
    function claim(uint256 index) external {
        if (paying) revert AlreadyScheduled();
        if (index >= claims.length) revert NothingScheduled();
        Line memory line = claims[index];
        if (msg.sender != line.to) revert NotPayer();
        // Block schedule and pay while this value is still in the contract.
        // A revert restores the claim and clears the flag.
        paying = true;
        claims[index] = claims[claims.length - 1];
        claims.pop();
        (bool ok,) = line.to.call{value: line.amount}("");
        if (!ok) revert TransferFailed();
        paying = false;
        emit Paid(line.to, line.amount);
    }
}
