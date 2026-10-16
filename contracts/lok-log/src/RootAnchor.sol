// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title RootAnchor
/// @notice Records periodic committed batch roots and their commit certificates.
///         A batch is anchored when `post` has stored its next root. Callers
///         must read `hasAnchor` before treating `lastAnchoredHeight` as real:
///         height 0 is a valid first batch, and the unset height is also 0.
///         This contract does not verify BLS, charge a fee, or enforce a
///         challenge delay. It is not a deploy script.
contract RootAnchor {
    struct Record {
        bytes32 nextRoot;
        bytes certificate;
    }

    mapping(uint64 height => Record) private _records;
    uint64 private _lastHeight;
    bool private _hasAnchor;

    event RootPosted(uint64 indexed height, bytes32 nextRoot);

    error EmptyCertificate();
    error HeightNotAfterAnchor(uint64 height, uint64 anchored);
    error NotAnchored(uint64 height);

    /// @notice Store one certified batch. `certificate` is the commit certificate
    ///         for `nextRoot` at `height`. Heights must move forward.
    function post(uint64 height, bytes32 nextRoot, bytes calldata certificate) external {
        if (certificate.length == 0) revert EmptyCertificate();
        if (_hasAnchor && height <= _lastHeight) revert HeightNotAfterAnchor(height, _lastHeight);
        _records[height] = Record({nextRoot: nextRoot, certificate: certificate});
        _lastHeight = height;
        _hasAnchor = true;
        emit RootPosted(height, nextRoot);
    }

    function hasAnchor() external view returns (bool) {
        return _hasAnchor;
    }

    /// @dev Zero both before any post and after a post of height 0. Check `hasAnchor`.
    function lastAnchoredHeight() external view returns (uint64) {
        return _lastHeight;
    }

    function anchoredRoot(uint64 height) external view returns (bytes32 nextRoot, bytes memory certificate) {
        Record storage row = _records[height];
        if (row.certificate.length == 0) revert NotAnchored(height);
        return (row.nextRoot, row.certificate);
    }

    function isAnchored(uint64 height, bytes32 nextRoot) external view returns (bool) {
        Record storage row = _records[height];
        return row.certificate.length != 0 && row.nextRoot == nextRoot;
    }
}
