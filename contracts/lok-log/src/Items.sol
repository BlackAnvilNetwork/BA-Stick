// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155URIStorage} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155URIStorage.sol";
import {ItemIds} from "./libraries/ItemIds.sol";

/// @title Items
/// @notice Access-controlled ERC-1155 for exported tradable items on settlement.
///         Implements `IItems` (mint/burn/balanceOf). CharacterCheckpoint should be the
///         sole `MINTER_ROLE` holder (mint on export, burn on import).
///         `burn` requires `from == msg.sender` or `isApprovedForAll(from, msg.sender)` so a
///         compromised minter cannot burn arbitrary wallets without prior approval.
///         Players must `setApprovalForAll(checkpoint, true)` before `importItem`.
///         New item types are added via `REGISTRAR_ROLE` without redeploying — use
///         content-addressed ids from `ItemIds` (catalog `slug` as `typeId`).
///
///         Stable id scheme (matches engine `ids.rs` / Golden.t.sol):
///           fungible: ItemIds.fungible(slug)   // keccak(0x00 || slug)
///           unique:   ItemIds.unique(slug, n)  // keccak(0x01 || slug || u64 BE)
///
///         Craft/catalog defs keep small-int ids + slugs off-chain; chain export/import
///         and AH metadata should use these keccak ids. Newly registered ids need no
///         contract upgrade — checkpoint + watchers treat itemId as opaque uint256.
contract Items is ERC1155, ERC1155URIStorage, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    struct ItemMeta {
        bool registered;
        bool uniqueItem;
        /// 0 = uncapped (typical fungibles). Unique types usually set maxSupply = 1.
        uint256 maxSupply;
        uint256 totalSupply;
        string typeId;
    }

    mapping(uint256 id => ItemMeta) private _meta;

    error ZeroAddress();
    error AlreadyRegistered(uint256 id);
    error NotRegistered(uint256 id);
    error BadAmount();
    error SupplyCap(uint256 id);
    error UniqueAmount();
    error NotApproved();

    event ItemRegistered(
        uint256 indexed id, string typeId, bool uniqueItem, uint256 maxSupply, string tokenURI
    );
    event ItemURIUpdated(uint256 indexed id, string tokenURI);

    constructor(address admin, string memory baseURI_) ERC1155(baseURI_) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REGISTRAR_ROLE, admin);
        _setBaseURI(baseURI_);
    }

    /// @notice Register `id` (usually `ItemIds.fungible(typeId)` or `ItemIds.unique(typeId, n)`).
    function registerItem(
        uint256 id,
        string calldata typeId,
        string calldata tokenURI,
        bool uniqueItem,
        uint256 maxSupply
    ) external onlyRole(REGISTRAR_ROLE) {
        _register(id, typeId, tokenURI, uniqueItem, maxSupply);
    }

    /// @notice Register a fungible whose id is `ItemIds.fungible(typeId)` (catalog slug).
    function registerFungible(string calldata typeId, string calldata tokenURI, uint256 maxSupply)
        external
        onlyRole(REGISTRAR_ROLE)
        returns (uint256 id)
    {
        id = ItemIds.fungible(typeId);
        _register(id, typeId, tokenURI, false, maxSupply);
    }

    /// @notice Register a unique instance id = `ItemIds.unique(typeId, instanceId)` with supply 1.
    function registerUnique(string calldata typeId, uint64 instanceId, string calldata tokenURI)
        external
        onlyRole(REGISTRAR_ROLE)
        returns (uint256 id)
    {
        id = ItemIds.unique(typeId, instanceId);
        _register(id, typeId, tokenURI, true, 1);
    }

    /// @notice Batch register (precomputed ids; no auto-hash).
    function registerItems(
        uint256[] calldata ids,
        string[] calldata typeIds,
        string[] calldata tokenURIs,
        bool[] calldata uniqueItems,
        uint256[] calldata maxSupplies
    ) external onlyRole(REGISTRAR_ROLE) {
        uint256 n = ids.length;
        if (
            typeIds.length != n || tokenURIs.length != n || uniqueItems.length != n
                || maxSupplies.length != n
        ) {
            revert BadAmount();
        }
        for (uint256 i = 0; i < n; i++) {
            _register(ids[i], typeIds[i], tokenURIs[i], uniqueItems[i], maxSupplies[i]);
        }
    }

    function setItemURI(uint256 id, string calldata tokenURI) external onlyRole(REGISTRAR_ROLE) {
        if (!_meta[id].registered) revert NotRegistered(id);
        _setURI(id, tokenURI);
        emit ItemURIUpdated(id, tokenURI);
    }

    function setBaseURI(string calldata baseURI_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setBaseURI(baseURI_);
    }

    function exists(uint256 id) external view returns (bool) {
        return _meta[id].registered;
    }

    function itemMeta(uint256 id)
        external
        view
        returns (bool registered, bool uniqueItem, uint256 maxSupply, uint256 totalSupply, string memory typeId)
    {
        ItemMeta storage m = _meta[id];
        return (m.registered, m.uniqueItem, m.maxSupply, m.totalSupply, m.typeId);
    }

    function fungibleIdOf(string calldata typeId) external pure returns (uint256) {
        return ItemIds.fungible(typeId);
    }

    function uniqueIdOf(string calldata typeId, uint64 instanceId) external pure returns (uint256) {
        return ItemIds.unique(typeId, instanceId);
    }

    /// @dev IItems.mint — checkpoint export path.
    function mint(address to, uint256 id, uint256 amount) external onlyRole(MINTER_ROLE) {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert BadAmount();
        ItemMeta storage m = _meta[id];
        if (!m.registered) revert NotRegistered(id);
        if (m.uniqueItem && amount != 1) revert UniqueAmount();
        if (m.maxSupply != 0 && m.totalSupply + amount > m.maxSupply) revert SupplyCap(id);
        unchecked {
            m.totalSupply += amount;
        }
        _mint(to, id, amount, "");
    }

    /// @dev IItems.burn — checkpoint import path. MINTER_ROLE should be Checkpoint only.
    ///      Operator must be `from` or an ERC-1155 operator approved via `setApprovalForAll`.
    function burn(address from, uint256 id, uint256 amount) external onlyRole(MINTER_ROLE) {
        if (from == address(0)) revert ZeroAddress();
        if (amount == 0) revert BadAmount();
        if (from != msg.sender && !isApprovedForAll(from, msg.sender)) revert NotApproved();
        ItemMeta storage m = _meta[id];
        if (!m.registered) revert NotRegistered(id);
        if (m.totalSupply < amount) revert BadAmount();
        unchecked {
            m.totalSupply -= amount;
        }
        _burn(from, id, amount);
    }

    function uri(uint256 id) public view override(ERC1155, ERC1155URIStorage) returns (string memory) {
        return ERC1155URIStorage.uri(id);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _register(
        uint256 id,
        string memory typeId,
        string memory tokenURI,
        bool uniqueItem,
        uint256 maxSupply
    ) internal {
        if (_meta[id].registered) revert AlreadyRegistered(id);
        if (bytes(typeId).length == 0) revert BadAmount();
        if (uniqueItem && maxSupply == 0) revert BadAmount();
        _meta[id] = ItemMeta({
            registered: true,
            uniqueItem: uniqueItem,
            maxSupply: maxSupply,
            totalSupply: 0,
            typeId: typeId
        });
        if (bytes(tokenURI).length > 0) _setURI(id, tokenURI);
        emit ItemRegistered(id, typeId, uniqueItem, maxSupply, tokenURI);
    }
}
