// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AhEscrow
/// @notice First-party auction-house payment escrow. Buyers pay **native ETH**
///         (EOA, Safe, or EEZ `CrossChainProxy` with `msg.value`). ETH is paid
///         straight to the seller payout address — this contract does not hold
///         a long-lived player balance, and the character log never credits
///         settlement ETH. Upstream EEZ `periphery/Bridge.sol` is test-only; do
///         not treat it as this contract.
///
///         Flow: LISTING_ROLE opens an ask that mirrors a log listing id → buyer
///         calls `buyAsk{value}` → seller receives ETH → `AskFilled` is emitted →
///         the game server appends a log `chainFill` (items only).
///
///         Listing ids are single-use: once opened, filled, or cancelled they
///         cannot be reopened (`used` flag). Buyers cannot name the seller's
///         character token as the recipient.
contract AhEscrow {
    bytes32 public constant LISTING_ROLE = keccak256("LISTING_ROLE");
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;

    struct Ask {
        address payable sellerPayout;
        uint256 sellerTokenId;
        uint256 itemId;
        uint256 amount;
        uint256 priceWei;
        bool open;
        bool used;
    }

    mapping(uint256 listingId => Ask) public asks;
    mapping(bytes32 role => mapping(address account => bool)) private _roles;
    uint256 private _locked = 1;

    event AskOpened(
        uint256 indexed listingId,
        uint256 indexed sellerTokenId,
        address sellerPayout,
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
        uint256 itemId,
        uint256 amount
    );
    event AskCancelled(uint256 indexed listingId);
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

    constructor(address admin) {
        if (admin == address(0)) revert BadAddress();
        _grant(DEFAULT_ADMIN_ROLE, admin);
        _grant(LISTING_ROLE, admin);
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

    function _grant(bytes32 role, address account) private {
        if (account == address(0)) revert BadAddress();
        if (!_roles[role][account]) {
            _roles[role][account] = true;
            emit RoleGranted(role, account, msg.sender);
        }
    }

    /// @notice Register an ask the log already escrowed. `listingId` must match the engine ask id.
    ///         Ids are single-use: a filled or cancelled id cannot be reopened.
    function openAsk(
        uint256 listingId,
        uint256 sellerTokenId,
        address payable sellerPayout,
        uint256 itemId,
        uint256 amount,
        uint256 priceWei
    ) external onlyRole(LISTING_ROLE) {
        if (listingId == 0 || itemId == 0 || sellerTokenId == 0) revert BadId();
        if (amount == 0 || priceWei == 0) revert BadAmount();
        if (sellerPayout == address(0)) revert BadAddress();
        Ask storage ask = asks[listingId];
        if (ask.open || ask.used) revert AskExists();

        asks[listingId] = Ask({
            sellerPayout: sellerPayout,
            sellerTokenId: sellerTokenId,
            itemId: itemId,
            amount: amount,
            priceWei: priceWei,
            open: true,
            used: true
        });
        emit AskOpened(listingId, sellerTokenId, sellerPayout, itemId, amount, priceWei);
    }

    /// @notice Pull an unsold ask (log cancel/reclaim should run after this succeeds).
    function cancelAsk(uint256 listingId) external onlyRole(LISTING_ROLE) {
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
    function buyAsk(uint256 listingId, uint256 buyerTokenId) external payable nonReentrant {
        if (buyerTokenId == 0) revert BadId();
        Ask storage ask = asks[listingId];
        if (!ask.open) revert AskClosed();
        if (buyerTokenId == ask.sellerTokenId) revert BadId();
        if (msg.value < ask.priceWei) revert WrongPrice();

        uint256 price = ask.priceWei;
        address payable payout = ask.sellerPayout;
        uint256 itemId = ask.itemId;
        uint256 amount = ask.amount;
        ask.open = false;

        (bool paid,) = payout.call{value: price}("");
        if (!paid) revert TransferFailed();

        uint256 excess = msg.value - price;
        if (excess > 0) {
            (bool refunded,) = payable(msg.sender).call{value: excess}("");
            if (!refunded) revert TransferFailed();
        }

        emit AskFilled(listingId, msg.sender, buyerTokenId, payout, price, itemId, amount);
    }

    /// @dev Naked ETH is rejected; payment must go through `buyAsk`.
    receive() external payable {
        revert BadAmount();
    }
}
