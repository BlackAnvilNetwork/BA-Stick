// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {ICharacterStateHook} from "./interfaces/ICharacterNFT.sol";

/// @title CharacterNFT
/// @notice Pure ownership token for characters. All game data lives in CharacterState.
///         Every transfer (not mint) calls CharacterState.onTransfer, which bumps the character's
///         version + revision: outstanding server signatures die and marketplaces can detect changes.
///         UUPS upgrades must be authorized by `upgradeAuthority` (Timelock) once set.
contract CharacterNFT is Initializable, ERC721Upgradeable, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE"); // CharacterFactory

    // NOTE: append-only.
    ICharacterStateHook public state;
    uint256 public nextTokenId; // last minted id; ids start at 1
    string private _baseTokenURI;
    /// @notice Timelock (or similar) that alone may authorize UUPS upgrades. When unset, DEFAULT_ADMIN may upgrade (anvil).
    address public upgradeAuthority;

    error StateNotSet();
    error ZeroAddress();
    error UnauthorizedUpgrade();
    error UpgradeAuthorityAlreadySet();

    event StateSet(address state);
    event BaseURISet(string baseURI);
    event UpgradeAuthoritySet(address indexed authority);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, string calldata name_, string calldata symbol_, string calldata baseURI_)
        external
        initializer
    {
        if (admin == address(0)) revert ZeroAddress();
        __ERC721_init(name_, symbol_);
        __AccessControl_init();
        __UUPSUpgradeable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, admin); // multisig
        _baseTokenURI = baseURI_;
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

    function setState(address state_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (state_ == address(0)) revert ZeroAddress();
        state = ICharacterStateHook(state_);
        emit StateSet(state_);
    }

    function setBaseURI(string calldata baseURI_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _baseTokenURI = baseURI_;
        emit BaseURISet(baseURI_);
    }

    /// Non-safe mint on purpose: no receiver callback, so the factory can't be reentered mid-creation.
    function mint(address to) external onlyRole(MINTER_ROLE) returns (uint256 tokenId) {
        if (address(state) == address(0)) revert StateNotSet();
        unchecked {
            tokenId = ++nextTokenId;
        }
        _mint(to, tokenId);
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        from = super._update(to, tokenId, auth);
        if (from != address(0)) state.onTransfer(tokenId); // not on mint
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function supportsInterface(bytes4 id)
        public
        view
        override(ERC721Upgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(id);
    }
}
