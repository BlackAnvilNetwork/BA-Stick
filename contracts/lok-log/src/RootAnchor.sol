// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title RootAnchor
/// @notice Records periodic committed batch roots and their commit certificates.
///         A batch is anchored when `post` has stored its next root. Callers
///         must read `hasAnchor` before treating `lastAnchoredHeight` as real:
///         height 0 is a valid first batch, and the unset height is also 0.
///         A certified checkpoint is a separate record. `postCheckpointBlob`
///         stores the blob commitment and the keccak of the checkpoint bytes.
///         The blob bytes are not stored here. `post` does not write that record.
///         This contract does not verify BLS, charge a fee, or enforce a
///         challenge delay. It is not a deploy script.
contract RootAnchor {
    struct Record {
        bytes32 nextRoot;
        bytes certificate;
    }

    /// @dev EIP-4844 commitments are 48 bytes. The blob itself is not kept.
    struct CheckpointBlob {
        bytes commitment;
        bytes32 checkpointKeccak;
    }

    mapping(uint64 height => Record) private _records;
    mapping(bytes32 checkpointKeccak => CheckpointBlob) private _checkpointBlobs;
    uint64 private _lastHeight;
    bool private _hasAnchor;

    event RootPosted(uint64 indexed height, bytes32 nextRoot);
    event CheckpointBlobPosted(bytes32 indexed checkpointKeccak, bytes commitment);

    error EmptyCertificate();
    error HeightNotAfterAnchor(uint64 height, uint64 anchored);
    error NotAnchored(uint64 height);
    error EmptyCommitment();
    error BadCommitmentLength(uint256 length);
    error CheckpointBlobMissing(bytes32 checkpointKeccak);
    error CheckpointBlobConflict(bytes32 checkpointKeccak);

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

    /// @notice Store the blob commitment and the keccak of one certified checkpoint.
    ///         `commitment` is 48 bytes. The checkpoint bytes are not accepted here.
    ///         The same pair may be posted again. A different commitment for the same
    ///         keccak is refused. This does not anchor a 20 Hz batch.
    function postCheckpointBlob(bytes calldata commitment, bytes32 checkpointKeccak) external {
        if (commitment.length == 0) revert EmptyCommitment();
        if (commitment.length != 48) revert BadCommitmentLength(commitment.length);
        CheckpointBlob storage row = _checkpointBlobs[checkpointKeccak];
        if (row.commitment.length != 0) {
            if (keccak256(row.commitment) != keccak256(commitment)) {
                revert CheckpointBlobConflict(checkpointKeccak);
            }
            return;
        }
        _checkpointBlobs[checkpointKeccak] = CheckpointBlob({
            commitment: commitment,
            checkpointKeccak: checkpointKeccak
        });
        emit CheckpointBlobPosted(checkpointKeccak, commitment);
    }

    /// @notice The commitment and keccak recorded for a certified checkpoint.
    function checkpointBlob(bytes32 checkpointKeccak)
        external
        view
        returns (bytes memory commitment, bytes32 storedKeccak)
    {
        CheckpointBlob storage row = _checkpointBlobs[checkpointKeccak];
        if (row.commitment.length == 0) revert CheckpointBlobMissing(checkpointKeccak);
        return (row.commitment, row.checkpointKeccak);
    }
}
