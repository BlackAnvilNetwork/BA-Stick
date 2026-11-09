// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title WorldManifest
/// @notice One world. The published head is a Merkle root over characters,
///         bound to the ruleset that replayed them. The leader is an address
///         plus an epoch, not an enum. Role zero is unregistered. Replica is
///         the only registered role. An observer is an unregistered node.
/// @dev The admin is the rotator until bonded replicas can vote. Until that
///      vote exists, the admin is the trust root. A leader that misses two
///      checkpoint intervals is stale. `rotateLeader` is still the admin's act.
contract WorldManifest {
    uint8 public constant ROLE_NONE = 0;
    uint8 public constant ROLE_REPLICA = 1;

    /// @notice Ten minutes. Clients treat play between checkpoints as provisional.
    uint64 public constant CHECKPOINT_INTERVAL = 600;

    address public admin;
    bool public genesisSet;
    bytes32 public worldGenesis;
    bytes32 public head;
    bytes32 public merkleRoot;
    bytes32 public rulesetHash;
    uint64 public epoch;
    address public leader;
    string public journalUri;
    bytes32 public journalHash;
    uint64 public headEntries;
    uint64 public lastCheckpointAt;

    event GenesisPublished(bytes32 worldGenesis, address leader);
    event CheckpointPublished(uint64 indexed epoch, bytes32 head, address leader, uint64 headEntries);
    event LeaderRotated(uint64 indexed epoch, address leader);

    error NotAdmin();
    error GenesisAlreadySet();
    error GenesisMissing();
    error ZeroLeader();

    constructor(address admin_) {
        if (admin_ == address(0)) revert NotAdmin();
        admin = admin_;
    }

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    function publishGenesis(
        bytes32 worldGenesis_,
        bytes32 head_,
        bytes32 merkleRoot_,
        bytes32 rulesetHash_,
        address leader_,
        string calldata journalUri_,
        bytes32 journalHash_,
        uint64 headEntries_
    ) external onlyAdmin {
        if (genesisSet) revert GenesisAlreadySet();
        if (leader_ == address(0)) revert ZeroLeader();
        genesisSet = true;
        worldGenesis = worldGenesis_;
        head = head_;
        merkleRoot = merkleRoot_;
        rulesetHash = rulesetHash_;
        epoch = 1;
        leader = leader_;
        journalUri = journalUri_;
        journalHash = journalHash_;
        headEntries = headEntries_;
        lastCheckpointAt = uint64(block.timestamp);
        emit GenesisPublished(worldGenesis_, leader_);
        emit CheckpointPublished(1, head_, leader_, headEntries_);
    }

    function checkpoint(
        bytes32 head_,
        bytes32 merkleRoot_,
        bytes32 rulesetHash_,
        string calldata journalUri_,
        bytes32 journalHash_,
        uint64 headEntries_
    ) external {
        if (!genesisSet) revert GenesisMissing();
        if (msg.sender != admin && msg.sender != leader) revert NotAdmin();
        head = head_;
        merkleRoot = merkleRoot_;
        rulesetHash = rulesetHash_;
        journalUri = journalUri_;
        journalHash = journalHash_;
        headEntries = headEntries_;
        lastCheckpointAt = uint64(block.timestamp);
        emit CheckpointPublished(epoch, head_, leader, headEntries_);
    }

    /// @notice Admin rotates the leader. A stale leader can keep serving until this runs.
    function rotateLeader(address leader_) external onlyAdmin {
        if (!genesisSet) revert GenesisMissing();
        if (leader_ == address(0)) revert ZeroLeader();
        leader = leader_;
        epoch += 1;
        emit LeaderRotated(epoch, leader_);
    }

    /// @notice True when two checkpoint intervals have passed since the last head.
    function leaderStale(uint64 nowTs) external view returns (bool) {
        if (!genesisSet) return false;
        return nowTs > lastCheckpointAt + (CHECKPOINT_INTERVAL * 2);
    }

    /// @notice Registered roles. Anything else, including an observer, is ROLE_NONE.
    function roleOf(address account) external view returns (uint8) {
        if (account == leader) return ROLE_REPLICA;
        return ROLE_NONE;
    }
}
