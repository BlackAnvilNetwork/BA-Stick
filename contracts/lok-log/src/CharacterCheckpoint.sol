// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ICharacterNFT} from "./interfaces/ICharacterNFT.sol";
import {IItems} from "./interfaces/IItems.sol";
import {IRulesetRegistry} from "./interfaces/IRulesetRegistry.sol";

/// @title CharacterCheckpoint
/// @notice Log-model replacement for CharacterState. The chain no longer stores the sheet (skills, materials,
///         equipment, craft counters). It stores ONE state root per character plus a hash-chained position in that
///         character's event log. A checkpoint is accepted only if:
///           - it extends the current root (prevRoot == stateRoot), covering the next log range (fromIndex == logIndex)
///           - it is signed by an active session-key signer (same registry, rotation and guardian model as before)
///           - it is computed under an accepted ruleset (RulesetRegistry)
///           - it is submitted, and paid for, by the character's owner (gas policy unchanged)
///         Items leave the game's trust bubble only through `exports` inside a signed checkpoint, and re-enter through
///         `importItem` plus a log event that consumes it. KEK custody is retired: there is no vault, and a checkpoint
///         with `kekOut != 0` reverts. The field stays in `Checkpoint` so the signed body hash matches the engine
///         until that side drops it too. Item imports use the inbound queue. Everything else (crafting, XP, abilities,
///         equipment) is off-chain game events, replayable by anyone from the published log.
///         External contracts still keep the same hooks: initCharacter (factory) and onTransfer (NFT).
///         Item import/export are gated by `importsEnabled` / `exportsEnabled` (default false) in addition to
///         `items != address(0)`. Players must approve this contract on Items before `importItem`.
///         UUPS upgrades must be authorized by `upgradeAuthority` (Timelock) once set.
contract CharacterCheckpoint is
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    EIP712Upgradeable,
    UUPSUpgradeable
{
    // ------------------------------------------------------------------ roles
    bytes32 public constant FACTORY_ROLE = keccak256("FACTORY_ROLE");   // seeds new characters
    bytes32 public constant NFT_ROLE = keccak256("NFT_ROLE");           // transfer hook
    bytes32 public constant ROTATOR_ROLE = keccak256("ROTATOR_ROLE");   // adds short-lived signers
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE"); // pause + revoke signers

    // ------------------------------------------------------------- typehashes
    bytes32 private constant CHECKPOINT_TYPEHASH = keccak256(
        "Checkpoint(uint256 tokenId,address player,uint32 version,uint256 deadline,bytes32 bodyHash)"
    );
    /// The engine's genesis state for a character is defined as this anchor; the first log event is Spawn.
    bytes32 public constant GENESIS_TAG = keccak256("LOK_GENESIS_V1");

    uint64 public constant MAX_SIGNER_TTL = 24 hours;

    // ---------------------------------------------------------------- storage
    // NOTE: append-only. Add new variables at the end; never reorder or retype.
    ICharacterNFT public nft;

    struct SignerInfo {
        uint64 expiry;
        uint32 epoch;
    }
    mapping(address => SignerInfo) public signers;
    uint32 public signerEpoch; // revokeAllSigners() bumps this

    // One storage slot (64+64+64+32+32 = 256 bits).
    struct Meta {
        uint64 logIndex;       // number of log entries committed so far (next checkpoint's fromIndex)
        uint64 inboundApplied; // inbound requests (item imports + KEK deposits) the committed log has consumed
        uint64 checkpointedAt; // timestamp of last accepted checkpoint (for finality / export-tier gating later)
        uint32 version;        // bumped on transfer only: kills outstanding signatures
        uint32 revision;       // bumps on any change (checkpoint or transfer): marketplace guard
    }
    mapping(uint256 => Meta) internal _meta;
    mapping(uint256 => bytes32) public stateRoot;   // root of the character's state tree
    /// Projection for cheap reads: level(16) | job(8) | subjob(8) | jobXp(32) | subjobXp(32) | locationId(16) | unspentPoints(16).
    /// Signed by the verifier alongside the root and checkable by replay; NOT proven by the chain.
    mapping(uint256 => uint256) public summary;
    mapping(uint256 => uint64) public inboundCount;  // inbound requests made on this token (imports + KEK deposits)

    IRulesetRegistry public rulesets;
    IItems public items;

    /// @notice When false (default), `importItem` reverts even if `items` is set.
    bool public importsEnabled;
    /// @notice When false (default), checkpoint `exports` minting reverts. Keep off until export policy is live.
    bool public exportsEnabled;
    /// @notice Soft cap on exports per checkpoint root span (0 = uncapped when exports are enabled).
    uint256 public maxExportsPerCheckpoint;
    /// @notice Timelock (or similar) that alone may authorize UUPS upgrades. When unset, DEFAULT_ADMIN may upgrade (anvil).
    address public upgradeAuthority;

    struct Export {
        uint256 itemId;
        uint32 amount;
    }

    /// One accepted span of the character's log. bodyHash in the signature = keccak256(abi.encode(Checkpoint)).
    struct Checkpoint {
        bytes32 prevRoot;
        bytes32 newRoot;
        uint64 fromIndex;
        uint64 toIndex;
        bytes32 logHash;         // content hash of the published log segment [fromIndex, toIndex)
        bytes32 rulesetHash;
        uint256 summary;
        uint64 inboundConsumed;  // cumulative inbound requests applied by the log up to toIndex
        uint256 kekOut;          // Retired. Must be 0. Kept so abi.encode(Checkpoint) stays stable for the engine.
        Export[] exports;        // items marked exported in newRoot; minted here as ERC-1155
    }

    struct Auth {
        uint32 version;
        uint256 deadline;
        bytes sig;
    }

    // ----------------------------------------------------------------- events
    event Checkpointed(
        uint256 indexed tokenId,
        bytes32 indexed newRoot,
        bytes32 prevRoot,
        uint64 fromIndex,
        uint64 toIndex,
        bytes32 logHash,
        bytes32 rulesetHash
    );
    event ItemExported(uint256 indexed tokenId, uint256 indexed itemId, uint32 amount, address to);
    event ItemImportRequested(uint256 indexed tokenId, uint64 indexed nonce, uint256 itemId, uint32 amount, address from);
    event VersionBumped(uint256 indexed tokenId, uint32 newVersion); // transfer
    event SignerAdded(address indexed signer, uint64 expiry);
    event SignerRevoked(address indexed signer);
    event AllSignersRevoked(uint32 newEpoch);
    event RulesetsSet(address rulesets);
    event ItemsSet(address items);
    event ImportsEnabledSet(bool enabled);
    event ExportsEnabledSet(bool enabled);
    event MaxExportsPerCheckpointSet(uint256 maxExports);
    event UpgradeAuthoritySet(address indexed authority);

    // ----------------------------------------------------------------- errors
    error NotOwner();
    error StaleVersion();
    error StaleRoot();
    error BadRange();
    error BadInbound();
    error BadExport();
    error BadImport();
    error Expired();
    error BadSignature();
    error BadSigner();
    error AlreadyInit();
    error RulesetNotAccepted();
    error NotConfigured();
    error ImportsDisabled();
    error ExportsDisabled();
    error UnauthorizedUpgrade();
    error UpgradeAuthorityAlreadySet();
    error ZeroAddress();
    /// @notice KEK custody is gone. Checkpoints may not queue a withdrawal.
    error KekRetired();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// Same signature as CharacterState.initialize so Deploy.s.sol wiring is unchanged; call setRulesets/setItems after.
    function initialize(address admin, address nft_, address rotator, address guardian) external initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __EIP712_init("CharacterCheckpoint", "1");
        __UUPSUpgradeable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, admin); // multisig
        _grantRole(ROTATOR_ROLE, rotator);
        _grantRole(GUARDIAN_ROLE, guardian);
        nft = ICharacterNFT(nft_);
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

    // ------------------------------------------------------------------ admin
    function setRulesets(address r) external onlyRole(DEFAULT_ADMIN_ROLE) {
        rulesets = IRulesetRegistry(r);
        emit RulesetsSet(r);
    }

    function setItems(address i) external onlyRole(DEFAULT_ADMIN_ROLE) {
        items = IItems(i);
        emit ItemsSet(i);
    }

    function setImportsEnabled(bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        importsEnabled = enabled;
        emit ImportsEnabledSet(enabled);
    }

    function setExportsEnabled(bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        exportsEnabled = enabled;
        emit ExportsEnabledSet(enabled);
    }

    function setMaxExportsPerCheckpoint(uint256 maxExports) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxExportsPerCheckpoint = maxExports;
        emit MaxExportsPerCheckpointSet(maxExports);
    }

    // ------------------------------------------- signer registry + guardian (unchanged from CharacterState)
    function addSigner(address signer, uint64 expiry) external onlyRole(ROTATOR_ROLE) whenNotPaused {
        if (signer == address(0) || expiry <= block.timestamp || expiry > block.timestamp + MAX_SIGNER_TTL) {
            revert BadSigner();
        }
        signers[signer] = SignerInfo(expiry, signerEpoch);
        emit SignerAdded(signer, expiry);
    }

    function revokeSigner(address signer) external onlyRole(GUARDIAN_ROLE) {
        delete signers[signer];
        emit SignerRevoked(signer);
    }

    function revokeAllSigners() external onlyRole(GUARDIAN_ROLE) {
        unchecked {
            ++signerEpoch;
        }
        emit AllSignersRevoked(signerEpoch);
    }

    function pause() external onlyRole(GUARDIAN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function isActiveSigner(address who) public view returns (bool) {
        SignerInfo memory s = signers[who];
        return s.expiry > block.timestamp && s.epoch == signerEpoch;
    }

    function _requireSigner(address who) internal view {
        if (!isActiveSigner(who)) revert BadSignature();
    }

    // -------------------------------------------------- creation / transfer
    function initCharacter(uint256 tokenId, uint8 startingJob) external onlyRole(FACTORY_ROLE) {
        if (stateRoot[tokenId] != bytes32(0)) revert AlreadyInit();
        stateRoot[tokenId] = keccak256(abi.encode(GENESIS_TAG, tokenId, startingJob));
        // level 1, chosen job, no subjob, location 0 (starting town)
        summary[tokenId] = uint256(1) | (uint256(startingJob) << 16);
    }

    /// Called by CharacterNFT on every non-mint transfer: kills outstanding signatures, bumps revision.
    /// The server must drop any uncommitted log tail for the old owner and rebase on the onchain root.
    function onTransfer(uint256 tokenId) external onlyRole(NFT_ROLE) {
        Meta storage m = _meta[tokenId];
        uint32 v;
        unchecked {
            v = ++m.version;
            ++m.revision;
        }
        emit VersionBumped(tokenId, v);
    }

    // ------------------------------------------------------------ checkpoints
    function checkpoint(uint256 tokenId, Checkpoint calldata c, Auth calldata a) external whenNotPaused nonReentrant {
        if (address(rulesets) == address(0)) revert NotConfigured();
        address player = nft.ownerOf(tokenId);
        // The NFT owner may submit. An active signer may relay, but is not the player.
        if (msg.sender != player && !isActiveSigner(msg.sender)) revert NotOwner();

        Meta memory m = _meta[tokenId];
        if (m.version != a.version) revert StaleVersion();
        if (block.timestamp > a.deadline) revert Expired();
        if (c.prevRoot != stateRoot[tokenId]) revert StaleRoot(); // fork / dupe protection
        if (c.fromIndex != m.logIndex || c.toIndex <= c.fromIndex) revert BadRange();
        if (c.inboundConsumed < m.inboundApplied || c.inboundConsumed > inboundCount[tokenId]) revert BadInbound();
        if (!rulesets.isAccepted(c.rulesetHash)) revert RulesetNotAccepted();

        _requireSigner(ECDSA.recover(_digest(player, tokenId, c, a), a.sig));
        if (c.kekOut != 0) revert KekRetired();

        // effects
        stateRoot[tokenId] = c.newRoot;
        summary[tokenId] = c.summary;
        m.logIndex = c.toIndex;
        m.inboundApplied = c.inboundConsumed;
        m.checkpointedAt = uint64(block.timestamp);
        unchecked {
            ++m.revision;
        }
        _meta[tokenId] = m;
        emit Checkpointed(tokenId, c.newRoot, c.prevRoot, c.fromIndex, c.toIndex, c.logHash, c.rulesetHash);

        // interactions last: 1155 mint calls the receiver
        uint256 n = c.exports.length;
        if (n != 0) {
            // Exports mint ERC-1155 unbound to a separate root registry — keep disabled by default.
            if (!exportsEnabled) revert ExportsDisabled();
            if (address(items) == address(0)) revert NotConfigured();
            if (maxExportsPerCheckpoint != 0 && n > maxExportsPerCheckpoint) revert BadExport();
            for (uint256 i; i < n; ++i) {
                Export calldata e = c.exports[i];
                if (e.amount == 0) revert BadExport();
                items.mint(player, e.itemId, e.amount);
                emit ItemExported(tokenId, e.itemId, e.amount, player);
            }
        }
    }

    /// Burn a wallet item and queue it for re-entry. The emitted nonce is this token's next inbound id, shared with
    /// KEK deposits. The engine must apply that nonce once, in order; the next checkpoint's `inboundConsumed` is how
    /// many of those ids the log has consumed. Watchers cross-check the log against these events.
    /// A pending import travels with the character if it is transferred before the log applies it.
    /// Requires `importsEnabled` and `items` set. With real `Items`, the player must
    /// `setApprovalForAll(checkpoint, true)` so this contract can burn.
    function importItem(uint256 tokenId, uint256 itemId, uint32 amount) external whenNotPaused nonReentrant {
        if (!importsEnabled) revert ImportsDisabled();
        if (address(items) == address(0)) revert NotConfigured();
        if (nft.ownerOf(tokenId) != msg.sender) revert NotOwner();
        if (amount == 0) revert BadImport();
        uint64 nonce;
        unchecked {
            nonce = ++inboundCount[tokenId];
        }
        items.burn(msg.sender, itemId, amount);
        emit ItemImportRequested(tokenId, nonce, itemId, amount, msg.sender);
    }

    function _digest(address player, uint256 tokenId, Checkpoint calldata c, Auth calldata a)
        internal
        view
        returns (bytes32)
    {
        return _hashTypedDataV4(
            keccak256(abi.encode(CHECKPOINT_TYPEHASH, tokenId, player, a.version, a.deadline, keccak256(abi.encode(c))))
        );
    }

    // ------------------------------------------------------------------ views
    function version(uint256 tokenId) external view returns (uint32) {
        return _meta[tokenId].version;
    }

    function revision(uint256 tokenId) external view returns (uint32) {
        return _meta[tokenId].revision;
    }

    function logIndex(uint256 tokenId) external view returns (uint64) {
        return _meta[tokenId].logIndex;
    }

    function inboundApplied(uint256 tokenId) external view returns (uint64) {
        return _meta[tokenId].inboundApplied;
    }

    function level(uint256 tokenId) external view returns (uint16) {
        return uint16(summary[tokenId]);
    }

    /// One-call read for the server's prepareCheckpoint and for login. The full sheet is resolved off-chain from
    /// stateRoot + the published log, then verified against the root.
    function getCheckpointState(uint256 tokenId)
        external
        view
        returns (bytes32 root, uint256 summary_, Meta memory meta, uint64 inbound)
    {
        return (stateRoot[tokenId], summary[tokenId], _meta[tokenId], inboundCount[tokenId]);
    }
}
