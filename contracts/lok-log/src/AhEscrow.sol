// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/// @dev Minimal NFT ownership read used at fill time (CharacterNFT).
interface ICharacterOwnerOf {
    function ownerOf(uint256 tokenId) external view returns (address);
}

/// @title AhEscrow
/// @notice First-party auction-house payment escrow. Buyers pay **native ETH**
///         (EOA, Safe, or EEZ `CrossChainProxy` with `msg.value`). At fill, ETH
///         goes to `ownerOf(sellerTokenId)` (never a client-supplied address),
///         minus a 1% marketplace fee. Of that fee, `VAULT_FEE_BPS` (50) is the
///         guild-vault share and `TREASURY_FEE_BPS` (50) is the treasury share.
///         Neither share is sent on fill. A change to the split waits on the
///         ruleset timelock (`RulesetRegistry.MIN_DELAY`, 1 days). This contract
///         cannot see that timelock, so the shares stay these constants. The
///         floor is not Deploy's 48 hours and not `PvpBounty.claimDelay`.
///         `feeRecipient` is the treasury address of record and is not paid here.
///         This contract does not hold a long-lived player balance. The fee is
///         not a player balance. The character log never credits settlement ETH.
///         Upstream EEZ `periphery/Bridge.sol` is test-only; do not treat it as
///         this contract. There is no second fee and no new token.
///
///         Flow: LISTING_ROLE opens an ask that mirrors a log listing id → buyer
///         calls `buyAsk{value}` → seller paid, fee held → `AskFilled` is emitted →
///         the game server appends a log `chainFill` (items only).
///
///         Listing ids are single-use: once opened, filled, or cancelled they
///         cannot be reopened (`used` flag). Buyers cannot name the seller's
///         character token as the recipient. Owner change cancels open listings
///         off-chain (app watcher); fill still pays whoever owns the NFT then.
///         Direct buys (`buyAsk`) require `msg.sender == ownerOf(buyerTokenId)`.
///         Relayed / EEZ buys use `buyAskFor` with an EIP-712 signature from that owner
///         authorizing this caller as the relayer.
///         GUARDIAN_ROLE can pause openAsk/buyAsk/buyAskFor; DEFAULT_ADMIN_ROLE unpauses.
///         Not upgradeable — a behavior change is a new deployment.
contract AhEscrow is Pausable, EIP712 {
    bytes32 public constant LISTING_ROLE = keccak256("LISTING_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;

    /// @notice EIP-712 payload authorizing `relayer` to fill `listingId` into `buyerTokenId` until `deadline`.
    bytes32 public constant BUY_ASK_FOR_TYPEHASH =
        keccak256("BuyAskFor(uint256 listingId,uint256 buyerTokenId,address relayer,uint256 deadline)");

    /// @notice 1% of sale price (fee = price * FEE_BPS / BPS_DENOM, floor).
    uint256 public constant FEE_BPS = 100;
    uint256 public constant BPS_DENOM = 10_000;

    /// @notice Guild-vault share of the sale, in bps. Half of `FEE_BPS`.
    ///         A change waits on the ruleset timelock (`RulesetRegistry.MIN_DELAY`, 1 days).
    ///         This contract cannot see that timelock, so the share stays this constant.
    uint256 public constant VAULT_FEE_BPS = 50;

    /// @notice Treasury share of the sale, in bps. Half of `FEE_BPS`.
    ///         A change waits on the ruleset timelock (`RulesetRegistry.MIN_DELAY`, 1 days).
    ///         This contract cannot see that timelock, so the share stays this constant.
    uint256 public constant TREASURY_FEE_BPS = 50;

    struct Ask {
        uint256 sellerTokenId;
        uint256 itemId;
        uint256 amount;
        uint256 priceWei;
        bool open;
        bool used;
    }

    ICharacterOwnerOf public immutable characterNft;
    /// @notice Treasury address of record. Fill does not pay it. The treasury share stays here.
    address payable public feeRecipient;
    /// @notice Vault wei recorded from fills. It is not sent.
    uint256 public vaultHeldWei;
    /// @notice Treasury wei recorded from fills. It is not sent.
    uint256 public treasuryHeldWei;

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
    /// @notice The two shares were recorded and not transferred.
    event FeeSharesHeld(uint256 indexed listingId, uint256 vaultWei, uint256 treasuryWei);
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
    error NotOwner();
    error BadSignature();
    error Expired();

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
    /// @param feeRecipient_ Treasury address of record. Fill does not pay this address.
    constructor(address admin, address nft_, address payable feeRecipient_) EIP712("AhEscrow", "1") {
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

    /// @notice Rotate the treasury address of record. Does not change either share and does not release held wei.
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

    /// @notice Floor each share the same way `quoteFee` floors (`price * bps / BPS_DENOM`).
    ///         A zero fee is a zero vault share and a zero treasury share.
    ///         The two floors sum to the 1% fee, or to one wei less. That wei stays
    ///         in this contract with the shares and is not a third payout.
    function quoteFeeShares(uint256 priceWei) public pure returns (uint256 vaultWei, uint256 treasuryWei) {
        vaultWei = (priceWei * VAULT_FEE_BPS) / BPS_DENOM;
        treasuryWei = (priceWei * TREASURY_FEE_BPS) / BPS_DENOM;
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

    /// @notice Pay the ask in native ETH. Excess `msg.value` is refunded to `msg.sender`.
    ///         Does not credit the log. Does not send the vault share or the treasury share.
    /// @param listingId Engine ask id already opened on-chain.
    /// @param buyerTokenId Character that will receive the stack on the log after `AskFilled`.
    ///        Caller must own this token (`ownerOf(buyerTokenId) == msg.sender`).
    function buyAsk(uint256 listingId, uint256 buyerTokenId) external payable nonReentrant whenNotPaused {
        if (buyerTokenId == 0) revert BadId();
        // L-4: buyerTokenId must exist (ownerOf reverts for unminted ids).
        if (characterNft.ownerOf(buyerTokenId) != msg.sender) revert NotOwner();
        _fill(listingId, buyerTokenId);
    }

    /// @notice Relayed fill. `ownerSignature` is an EIP-712 `BuyAskFor` from `ownerOf(buyerTokenId)`
    ///         naming `msg.sender` as the relayer (EEZ proxy / MockEezSyncBuy). Excess refunds to the relayer.
    function buyAskFor(uint256 listingId, uint256 buyerTokenId, uint256 deadline, bytes calldata ownerSignature)
        external
        payable
        nonReentrant
        whenNotPaused
    {
        if (buyerTokenId == 0) revert BadId();
        if (block.timestamp > deadline) revert Expired();
        address owner = characterNft.ownerOf(buyerTokenId);
        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(BUY_ASK_FOR_TYPEHASH, listingId, buyerTokenId, msg.sender, deadline))
        );
        (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, ownerSignature);
        if (err != ECDSA.RecoverError.NoError || signer != owner) revert BadSignature();
        _fill(listingId, buyerTokenId);
    }

    function _fill(uint256 listingId, uint256 buyerTokenId) private {
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
        // Both shares stay here. Sending either one would apply it in this transaction.
        // A release waits on the ruleset timelock, which this contract cannot see.
        _holdShares(listingId, price);

        (bool paid,) = payout.call{value: sellerNet}("");
        if (!paid) revert TransferFailed();

        uint256 excess = msg.value - price;
        if (excess > 0) {
            (bool refunded,) = payable(msg.sender).call{value: excess}("");
            if (!refunded) revert TransferFailed();
        }

        emit AskFilled(listingId, msg.sender, buyerTokenId, payout, price, feeWei, itemId, amount);
    }

    /// @dev Record the floored shares. Do not transfer them.
    function _holdShares(uint256 listingId, uint256 price) private {
        (uint256 vaultWei, uint256 treasuryWei) = quoteFeeShares(price);
        vaultHeldWei += vaultWei;
        treasuryHeldWei += treasuryWei;
        emit FeeSharesHeld(listingId, vaultWei, treasuryWei);
    }

    /// @dev Naked ETH is rejected; payment must go through `buyAsk`.
    receive() external payable {
        revert BadAmount();
    }
}
