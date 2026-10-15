// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @dev Minimal NFT ownership read (CharacterNFT).
interface ICharacterOwnerOf {
    function ownerOf(uint256 tokenId) external view returns (address);
}

/// @title PvpBounty
/// @notice First-party Black Anvil PvP head-bounty escrow. Players place a fixed
///         **1 xDAI** (1e18 wei native value on Gnosis) on their character. The
///         game server (OPERATOR_ROLE) proposes a claim to the slayer wallet that
///         owns the NFT at propose time, then pays that snapshotted address after
///         `claimDelay`. Cancel refunds the original payer. A guardian can veto
///         a proposal during the delay.
///         Settlement value never appears on the character log — the server
///         appends `pvpBountyOpen` / `pvpBountyCancel` / `pvpKill` mirrors only.
contract PvpBounty is Pausable {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;

    /// @notice Fixed head-bounty: 1 xDAI (1e18 wei).
    uint256 public constant BOUNTY_WEI = 1 ether;

    ICharacterOwnerOf public immutable characterNft;
    /// @notice Seconds between proposeClaim and executeClaim. Zero on local anvil.
    ///         A non-zero delay is the guardian's window to veto or pause a hot-key drain.
    uint256 public immutable claimDelay;

    /// @dev tokenId → open bounty paid by that character's owner at place time.
    mapping(uint256 tokenId => bool) public open;
    /// @dev Original placer — cancel always refunds this address (Transfer-safe).
    mapping(uint256 tokenId => address) public payerOf;
    /// @dev Slayer payout snapshotted at propose time. executeClaim pays this address,
    ///      not whoever owns the slayer NFT when the delay elapses.
    mapping(uint256 victimTokenId => PendingClaim) public pendingClaim;

    struct PendingClaim {
        uint256 slayerTokenId;
        address payout;
        uint64 readyAt;
    }
    mapping(bytes32 role => mapping(address account => bool)) private _roles;
    uint256 private _locked = 1;

    event BountyOpened(uint256 indexed tokenId, address indexed payer, uint256 amountWei);
    event BountyCancelled(uint256 indexed tokenId, address indexed refundTo, uint256 amountWei);
    event BountyClaimed(
        uint256 indexed victimTokenId,
        uint256 indexed slayerTokenId,
        address indexed slayerPayout,
        uint256 amountWei
    );
    event ClaimProposed(
        uint256 indexed victimTokenId,
        uint256 indexed slayerTokenId,
        address indexed payout,
        uint64 readyAt
    );
    event ClaimVetoed(uint256 indexed victimTokenId, address indexed guardian);
    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);

    error BadAmount();
    error BadAddress();
    error AlreadyOpen();
    error NotOpen();
    error NotOwner();
    error SelfClaim();
    error Reentrancy();
    error SlayerMoved();
    error ClaimPending();
    error NoPending();
    error TooEarly();

    modifier nonReentrant() {
        if (_locked != 1) revert Reentrancy();
        _locked = 2;
        _;
        _locked = 1;
    }

    constructor(address characterNft_, address admin, address operator, uint256 claimDelay_) {
        if (characterNft_ == address(0) || admin == address(0) || operator == address(0)) {
            revert BadAddress();
        }
        if (claimDelay_ > 7 days) revert BadAmount();
        characterNft = ICharacterOwnerOf(characterNft_);
        claimDelay = claimDelay_;
        _roles[DEFAULT_ADMIN_ROLE][admin] = true;
        _roles[OPERATOR_ROLE][operator] = true;
        _roles[GUARDIAN_ROLE][admin] = true;
        emit RoleGranted(DEFAULT_ADMIN_ROLE, admin, msg.sender);
        emit RoleGranted(OPERATOR_ROLE, operator, msg.sender);
        emit RoleGranted(GUARDIAN_ROLE, admin, msg.sender);
    }

    function hasRole(bytes32 role, address account) public view returns (bool) {
        return _roles[role][account];
    }

    function grantRole(bytes32 role, address account) external {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert NotOwner();
        if (account == address(0)) revert BadAddress();
        _roles[role][account] = true;
        emit RoleGranted(role, account, msg.sender);
    }

    function revokeRole(bytes32 role, address account) external {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert NotOwner();
        _roles[role][account] = false;
        emit RoleRevoked(role, account, msg.sender);
    }

    function pause() external {
        if (!hasRole(GUARDIAN_ROLE, msg.sender)) revert NotOwner();
        _pause();
    }

    function unpause() external {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert NotOwner();
        _unpause();
    }

    /// @notice Escrow `BOUNTY_WEI` on `tokenId`. Caller must own the NFT.
    function place(uint256 tokenId) external payable whenNotPaused nonReentrant {
        if (msg.value != BOUNTY_WEI) revert BadAmount();
        if (characterNft.ownerOf(tokenId) != msg.sender) revert NotOwner();
        if (open[tokenId]) revert AlreadyOpen();
        open[tokenId] = true;
        payerOf[tokenId] = msg.sender;
        emit BountyOpened(tokenId, msg.sender, BOUNTY_WEI);
    }

    /// @notice Refund to the original payer (leave arena / cancel). Allowed while paused.
    function cancel(uint256 tokenId) external nonReentrant {
        if (!open[tokenId]) revert NotOpen();
        address owner = characterNft.ownerOf(tokenId);
        address payer = payerOf[tokenId];
        if (msg.sender != owner && msg.sender != payer && !hasRole(OPERATOR_ROLE, msg.sender)) {
            revert NotOwner();
        }
        open[tokenId] = false;
        payerOf[tokenId] = address(0);
        delete pendingClaim[tokenId];
        address payable refundTo = payable(payer != address(0) ? payer : owner);
        (bool ok, ) = refundTo.call{value: BOUNTY_WEI}("");
        require(ok, "refund failed");
        emit BountyCancelled(tokenId, refundTo, BOUNTY_WEI);
    }

    /// @notice Snapshot the slayer's owner. Reverts if that owner is not `expectedSlayer`,
    ///         so a Transfer that lands before this call cannot redirect the payout.
    function proposeClaim(uint256 victimTokenId, uint256 slayerTokenId, address expectedSlayer)
        external
        whenNotPaused
        nonReentrant
    {
        if (!hasRole(OPERATOR_ROLE, msg.sender)) revert NotOwner();
        if (victimTokenId == slayerTokenId) revert SelfClaim();
        if (!open[victimTokenId]) revert NotOpen();
        if (pendingClaim[victimTokenId].payout != address(0)) revert ClaimPending();
        if (expectedSlayer == address(0)) revert BadAddress();
        address owner = characterNft.ownerOf(slayerTokenId);
        if (owner != expectedSlayer) revert SlayerMoved();
        uint256 ready = block.timestamp + claimDelay;
        if (ready > type(uint64).max) revert BadAmount();
        pendingClaim[victimTokenId] = PendingClaim({
            slayerTokenId: slayerTokenId,
            payout: owner,
            readyAt: uint64(ready)
        });
        emit ClaimProposed(victimTokenId, slayerTokenId, owner, uint64(ready));
    }

    /// @notice Pay the address snapshotted in proposeClaim. Not the current slayer owner.
    function executeClaim(uint256 victimTokenId) external whenNotPaused nonReentrant {
        if (!hasRole(OPERATOR_ROLE, msg.sender)) revert NotOwner();
        PendingClaim memory pending = pendingClaim[victimTokenId];
        if (pending.payout == address(0)) revert NoPending();
        if (block.timestamp < pending.readyAt) revert TooEarly();
        if (!open[victimTokenId]) revert NotOpen();
        open[victimTokenId] = false;
        payerOf[victimTokenId] = address(0);
        delete pendingClaim[victimTokenId];
        (bool ok, ) = payable(pending.payout).call{value: BOUNTY_WEI}("");
        require(ok, "payout failed");
        emit BountyClaimed(victimTokenId, pending.slayerTokenId, pending.payout, BOUNTY_WEI);
    }

    /// @notice Drop a proposed claim without paying. The bounty stays open for a later claim or cancel.
    function vetoClaim(uint256 victimTokenId) external {
        if (!hasRole(GUARDIAN_ROLE, msg.sender)) revert NotOwner();
        if (pendingClaim[victimTokenId].payout == address(0)) revert NoPending();
        delete pendingClaim[victimTokenId];
        emit ClaimVetoed(victimTokenId, msg.sender);
    }
}
