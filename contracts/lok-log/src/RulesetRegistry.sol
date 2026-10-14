// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {IRulesetRegistry} from "./interfaces/IRulesetRegistry.sol";

/// @title RulesetRegistry
/// @notice Public, timelocked record of every game ruleset bundle: hash(engine wasm, rules modules, content tables,
///         invariants). Checkpoints are only accepted under an accepted ruleset, so "was this event legal?" always has
///         an answer for any point in history. Replaces the per-item / per-collection allowlists on CharacterState.
///         UUPS upgrades must be authorized by `upgradeAuthority` (Timelock) once set.
contract RulesetRegistry is Initializable, AccessControlUpgradeable, UUPSUpgradeable, IRulesetRegistry {
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");   // studio ops: normal releases
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE"); // multisig: may skip the timelock, logged

    /// @notice Floor for `minDelay` / `setMinDelay` — notice period cannot be disabled.
    uint64 public constant MIN_DELAY = 1 days;

    // NOTE: append-only.
    struct Ruleset {
        uint64 activatesAt; // 0 = unknown ruleset
        uint64 retiresAt;   // 0 = no retirement scheduled
        bool cancelled;
        string uri;         // where the bundle + human-readable diff are published
    }

    uint64 public minDelay; // notice period for normal releases (e.g. 48h)
    mapping(bytes32 => Ruleset) public rulesets;
    /// @notice Timelock (or similar) that alone may authorize UUPS upgrades. When unset, DEFAULT_ADMIN may upgrade (anvil).
    address public upgradeAuthority;
    /// @notice Hashes passed to `propose`, in order. A new proposal retires every earlier hash at its own `activatesAt`.
    bytes32[] public proposedRulesets;

    /// @dev Reserved for later upgrades. Shrink this gap when appending state. Do not reorder earlier variables.
    uint256[49] private __gap;

    event RulesetProposed(bytes32 indexed rulesetHash, uint64 activatesAt, string uri, bool emergency);
    event RulesetCancelled(bytes32 indexed rulesetHash);
    event RulesetRetirement(bytes32 indexed rulesetHash, uint64 retiresAt);
    event MinDelaySet(uint64 minDelay);
    event UpgradeAuthoritySet(address indexed authority);

    error ZeroHash();
    error AlreadyProposed();
    error DelayTooShort();
    error AlreadyActive();
    error UnknownRuleset();
    error BadTime();
    error UnauthorizedUpgrade();
    error UpgradeAuthorityAlreadySet();
    error ZeroAddress();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, uint64 minDelay_) external initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, admin); // multisig
        if (minDelay_ < MIN_DELAY) revert DelayTooShort();
        minDelay = minDelay_;
        emit MinDelaySet(minDelay_);
    }

    /// @notice Set once to the TimelockController that must authorize upgrades in production.
    function setUpgradeAuthority(address authority) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (upgradeAuthority != address(0)) revert UpgradeAuthorityAlreadySet();
        if (authority == address(0)) revert ZeroAddress();
        upgradeAuthority = authority;
        emit UpgradeAuthoritySet(authority);
    }

    function _authorizeUpgrade(address) internal override {
        if (upgradeAuthority != address(0)) {
            if (msg.sender != upgradeAuthority) revert UnauthorizedUpgrade();
        } else {
            _checkRole(DEFAULT_ADMIN_ROLE);
        }
    }

    function setMinDelay(uint64 d) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (d < MIN_DELAY) revert DelayTooShort();
        minDelay = d;
        emit MinDelaySet(d);
    }

    /// Normal releases must give at least `minDelay` notice. EMERGENCY_ROLE may use any delay (publicly logged).
    function propose(bytes32 rulesetHash, uint64 delay, string calldata uri) external {
        bool emergency = hasRole(EMERGENCY_ROLE, msg.sender);
        if (!emergency && !hasRole(PROPOSER_ROLE, msg.sender)) revert AccessControlUnauthorizedAccount(msg.sender, PROPOSER_ROLE);
        if (rulesetHash == bytes32(0)) revert ZeroHash();
        if (rulesets[rulesetHash].activatesAt != 0) revert AlreadyProposed();
        if (!emergency && delay < minDelay) revert DelayTooShort();
        uint64 at = uint64(block.timestamp) + delay;
        if (at == 0) revert BadTime();
        rulesets[rulesetHash] = Ruleset(at, 0, false, uri);
        // Supersede: every earlier ruleset stops being accepted when this one activates.
        // Pull an existing retirement forward when the new activation is sooner.
        uint256 n = proposedRulesets.length;
        for (uint256 i; i < n; ++i) {
            bytes32 prev = proposedRulesets[i];
            Ruleset storage old = rulesets[prev];
            if (old.retiresAt == 0 || old.retiresAt > at) {
                old.retiresAt = at;
                emit RulesetRetirement(prev, at);
            }
        }
        proposedRulesets.push(rulesetHash);
        emit RulesetProposed(rulesetHash, at, uri, emergency);
    }

    /// Cancel a proposal that has not activated yet.
    function cancel(bytes32 rulesetHash) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Ruleset storage r = rulesets[rulesetHash];
        if (r.activatesAt == 0) revert UnknownRuleset();
        if (block.timestamp >= r.activatesAt) revert AlreadyActive();
        r.cancelled = true;
        emit RulesetCancelled(rulesetHash);
    }

    /// Schedule a ruleset to stop being accepted (grace period for late checkpoints under the old rules).
    function retire(bytes32 rulesetHash, uint64 at) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Ruleset storage r = rulesets[rulesetHash];
        if (r.activatesAt == 0) revert UnknownRuleset();
        if (at < block.timestamp) revert BadTime();
        r.retiresAt = at;
        emit RulesetRetirement(rulesetHash, at);
    }

    function isAccepted(bytes32 rulesetHash) external view returns (bool) {
        Ruleset storage r = rulesets[rulesetHash];
        return r.activatesAt != 0 && !r.cancelled && block.timestamp >= r.activatesAt
            && (r.retiresAt == 0 || block.timestamp < r.retiresAt);
    }
}
