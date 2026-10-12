// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @dev Minimal NFT ownership read used at fill time (CharacterNFT).
interface ICharacterOwnerOf {
    function ownerOf(uint256 tokenId) external view returns (address);
}

/// @title AhEscrow
/// @notice First-party auction-house payment escrow. Buyers pay **native ETH**
///         (EOA, Safe, or EEZ `CrossChainProxy` with `msg.value`). At fill, ETH
///         goes to `ownerOf(sellerTokenId)` (never a client-supplied address),
///         minus a 1% marketplace fee to `feeRecipient`. This contract does not
///         hold a long-lived player balance, and the character log never credits
///         settlement ETH. Upstream EEZ `periphery/Bridge.sol` is test-only; do
///         not treat it as this contract.
///
///         Flow: LISTING_ROLE opens an ask that mirrors a log listing id → buyer
///         calls `buyAsk{value}` → fee + seller paid → `AskFilled` is emitted →
///         the game server appends a log `chainFill` (items only).
///
///         Listing ids are single-use: once opened, filled, or cancelled they
///         cannot be reopened (`used` flag). Buyers cannot name the seller's
///         character token as the recipient. Owner change cancels open listings
///         off-chain (app watcher); fill still pays whoever owns the NFT then.
///         GUARDIAN_ROLE can pause openAsk/buyAsk; DEFAULT_ADMIN_ROLE unpauses.
contract AhEscrow is Pausable {
    bytes32 public constant LISTING_ROLE = keccak256("LISTING_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;

    /// @notice 1% of sale price (fee = price * FEE_BPS / BPS_DENOM, floor).
    uint256 public constant FEE_BPS = 100;
    uint256 public constant BPS_DENOM = 10_000;

    struct Ask {
        uint256 sellerTokenId;
        uint256 itemId;
        uint256 amount;
        uint256 priceWei;
        bool open;
        bool used;
    }

    ICharacterOwnerOf public immutable characterNft;
    address payable public feeRecipient;

    mapping(uint256 listingId => Ask) public asks;
    mapping(bytes32 role => mapping(address account => bool)) private _roles;
    uint256 private _locked = 1;

    event AskOpened(
        uint256 indexed listingId,
        uint256 indexed sellerTokenId,
        uint256 itemId,
        uint256 amount,
        uint256 priceWei
    );
    event AskFilled(
        uint256 indexed listingId,
        address indexed buyer,
        uint256 indexed buyerTokenId,
        address sellerPayout,
        uint256 priceWei,
        uint256 feeWei,
        uint256 itemId,
        uint256 amount
    );
    event AskCancelled(uint256 indexed listingId);
    event FeeRecipientSet(address indexed feeRecipient);
    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);

    error BadAmount();
    error BadAddress();
    error BadId();
    error AskExists();
    error AskClosed();
    error WrongPrice();
    error TransferFailed();
    error Unauthorized();
    error Reentrant();

    modifier onlyRole(bytes32 role) {
        if (!_roles[role][msg.sender]) revert Unauthorized();
        _;
    }

    modifier nonReentrant() {
        if (_locked != 1) revert Reentrant();
        _locked = 2;
        _;
        _locked = 1;
    }

    /// @param admin Temporary admin (Deploy hands over to multisig). Also receives GUARDIAN_ROLE.
    /// @param nft_ Character NFT whose `ownerOf` receives sale proceeds at fill.
    /// @param feeRecipient_ Multisig/admin treasury for the 1% fee.
    constructor(address admin, address nft_, address payable feeRecipient_) {
        if (admin == address(0) || nft_ == address(0) || feeRecipient_ == address(0)) revert BadAddress();
        characterNft = ICharacterOwnerOf(nft_);
        feeRecipient = feeRecipient_;
        _grant(DEFAULT_ADMIN_ROLE, admin);
        _grant(LISTING_ROLE, admin);
        _grant(GUARDIAN_ROLE, admin);
        emit FeeRecipientSet(feeRecipient_);
    }

    function hasRole(bytes32 role, address account) external view returns (bool) {
        return _roles[role][account];
    }

    function grantRole(bytes32 role, address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grant(role, account);
    }

    function revokeRole(bytes32 role, address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_roles[role][account]) {
            _roles[role][account] = false;
            emit RoleRevoked(role, account, msg.sender);
        }
    }

    /// @notice Multisig/admin may rotate the fee treasury.
    function setFeeRecipient(address payable to) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (to == address(0)) revert BadAddress();
        feeRecipient = to;
        emit FeeRecipientSet(to);
    }

    /// @notice Guardian pause: blocks openAsk / buyAsk. Cancel remains available.
    function pause() external onlyRole(GUARDIAN_ROLE) {
        _pause();
    }

    /// @notice Safe/admin only may resume trading.
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /// @notice Floor split: `fee = price * 100 / 10000`, `sellerNet = price - fee`.
    function quoteFee(uint256 priceWei) public pure returns (uint256 feeWei, uint256 sellerNetWei) {
        feeWei = (priceWei * FEE_BPS) / BPS_DENOM;
        sellerNetWei = priceWei - feeWei;
    }

    function _grant(bytes32 role, address account) private {
        if (account == address(0)) revert BadAddress();
        if (!_roles[role][account]) {
            _roles[role][account] = true;
            emit RoleGranted(role, account, msg.sender);
        }
    }

    /// @notice Register an ask the log already escrowed. `listingId` must match the engine ask id.
    ///         Ids are single-use: a filled or cancelled id cannot be reopened.
    ///         Seller payout is **not** stored — `buyAsk` pays `ownerOf(sellerTokenId)`.
    function openAsk(
        uint256 listingId,
        uint256 sellerTokenId,
        uint256 itemId,
        uint256 amount,
        uint256 priceWei
    ) external onlyRole(LISTING_ROLE) whenNotPaused {
        if (listingId == 0 || itemId == 0 || sellerTokenId == 0) revert BadId();
        if (amount == 0 || priceWei == 0) revert BadAmount();
        Ask storage ask = asks[listingId];
        if (ask.open || ask.used) revert AskExists();

        asks[listingId] = Ask({
            sellerTokenId: sellerTokenId,
            itemId: itemId,
            amount: amount,
            priceWei: priceWei,
            open: true,
            used: true
        });
        emit AskOpened(listingId, sellerTokenId, itemId, amount, priceWei);
    }

    /// @notice Pull an unsold ask (log cancel/reclaim should run after this succeeds).
    function cancelAsk(uint256 listingId) external onlyRole(LISTING_ROLE) {
        _cancelAsk(listingId);
    }

    /// @notice Batch cancel for pause/incident response. Same per-id rules as `cancelAsk`.
    function cancelAsks(uint256[] calldata listingIds) external onlyRole(LISTING_ROLE) {
        uint256 n = listingIds.length;
        for (uint256 i; i < n; ++i) {
            _cancelAsk(listingIds[i]);
        }
    }

    function _cancelAsk(uint256 listingId) private {
        Ask storage ask = asks[listingId];
        if (!ask.open) revert AskClosed();
        ask.open = false;
        emit AskCancelled(listingId);
    }

    /// @notice Pay the ask in native ETH. Excess `msg.value` is refunded to `msg.sender`
    ///         (important for EEZ proxies that may overshoot). Does not credit the log.
    /// @param listingId Engine ask id already opened on-chain.
    /// @param buyerTokenId Character that will receive the stack on the log after `AskFilled`.
    ///        Must not be the seller's character token.
    function buyAsk(uint256 listingId, uint256 buyerTokenId) external payable nonReentrant whenNotPaused {
        if (buyerTokenId == 0) revert BadId();
        Ask storage ask = asks[listingId];
        if (!ask.open) revert AskClosed();
        if (buyerTokenId == ask.sellerTokenId) revert BadId();
        if (msg.value < ask.priceWei) revert WrongPrice();

        uint256 price = ask.priceWei;
        uint256 itemId = ask.itemId;
        uint256 amount = ask.amount;
        uint256 sellerTokenId = ask.sellerTokenId;
        ask.open = false;

        address owner = characterNft.ownerOf(sellerTokenId);
        if (owner == address(0)) revert BadAddress();
        address payable payout = payable(owner);

        (uint256 feeWei, uint256 sellerNet) = quoteFee(price);

        if (feeWei > 0) {
            (bool feePaid,) = feeRecipient.call{value: feeWei}("");
            if (!feePaid) revert TransferFailed();
        }
        (bool paid,) = payout.call{value: sellerNet}("");
        if (!paid) revert TransferFailed();

        uint256 excess = msg.value - price;
        if (excess > 0) {
            (bool refunded,) = payable(msg.sender).call{value: excess}("");
            if (!refunded) revert TransferFailed();
        }

        emit AskFilled(listingId, msg.sender, buyerTokenId, payout, price, feeWei, itemId, amount);
    }

    /// @dev Naked ETH is rejected; payment must go through `buyAsk`.
    receive() external payable {
        revert BadAmount();
    }
}
