// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ICharacterMint} from "./interfaces/ICharacterNFT.sol";

interface ICharacterInit {
    function initCharacter(uint256 tokenId, uint8 startingJob) external;
}

interface ICharacterNext {
    function nextTokenId() external view returns (uint256);
}

/// @title CharacterFactory
/// @notice Only path that mints a Character NFT and seeds its sheet. Charges an exact **native ETH**
///         mint fee (same unit as AhEscrow / EEZ `msg.value` — not WETH). Holds MINTER_ROLE on
///         CharacterNFT and FACTORY_ROLE on CharacterState.
///
///         Production minting uses `createCharacterFor(job, expectedTokenId)` so the chain id matches
///         the log token. Plain `createCharacter` is disabled (reverts).
///         GUARDIAN_ROLE can pause mints; DEFAULT_ADMIN_ROLE unpauses.
///         UUPS upgrades must be authorized by `upgradeAuthority` (Timelock) once set.
contract CharacterFactory is Initializable, AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    // NOTE: append-only.
    ICharacterMint public nft;
    ICharacterInit public state;
    mapping(uint8 => bool) public isStartingJob;
    uint256 public mintFee;
    /// @notice Timelock (or similar) that alone may authorize UUPS upgrades. When unset, DEFAULT_ADMIN may upgrade (anvil).
    address public upgradeAuthority;

    /// @dev Reserved for later upgrades. Shrink this gap when appending state. Do not reorder earlier variables.
    uint256[50] private __gap;

    event CharacterCreated(address indexed player, uint256 indexed tokenId, uint8 startingJob);
    event MintFeeSet(uint256 fee);
    event StartingJobSet(uint8 indexed job, bool ok);
    event UpgradeAuthoritySet(address indexed authority);

    error WrongFee();
    error BadJob();
    error WrongTokenId();
    error WithdrawFailed();
    error CreateCharacterDisabled();
    error UnauthorizedUpgrade();
    error UpgradeAuthorityAlreadySet();
    error ZeroAddress();
    error ZeroFee();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, address nft_, address state_, uint256 mintFee_) external initializer {
        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, admin); // multisig
        _grantRole(GUARDIAN_ROLE, admin);
        nft = ICharacterMint(nft_);
        state = ICharacterInit(state_);
        mintFee = mintFee_; // 0.001 ether at launch
        emit MintFeeSet(mintFee_);
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

    function pause() external onlyRole(GUARDIAN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /// @notice Disabled for production. Use `createCharacterFor` so payment binds to a reserved log token id.
    function createCharacter(uint8) external payable returns (uint256) {
        revert CreateCharacterDisabled();
    }

    /// @notice Mint exactly `expectedTokenId` (must be `nextTokenId + 1`) to `msg.sender`.
    ///         Binds payment to the log character that already reserved that id.
    function createCharacterFor(uint8 startingJob, uint256 expectedTokenId)
        external
        payable
        whenNotPaused
        returns (uint256 tokenId)
    {
        if (msg.value != mintFee) revert WrongFee();
        if (!isStartingJob[startingJob]) revert BadJob();
        uint256 next = ICharacterNext(address(nft)).nextTokenId() + 1;
        if (expectedTokenId == 0 || expectedTokenId != next) revert WrongTokenId();
        tokenId = nft.mint(msg.sender);
        if (tokenId != expectedTokenId) revert WrongTokenId(); // belt + suspenders
        state.initCharacter(tokenId, startingJob);
        emit CharacterCreated(msg.sender, tokenId, startingJob);
    }

    function setStartingJob(uint8 job, bool ok) external onlyRole(DEFAULT_ADMIN_ROLE) {
        isStartingJob[job] = ok;
        emit StartingJobSet(job, ok);
    }

    function setMintFee(uint256 fee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (fee == 0) revert ZeroFee();
        mintFee = fee;
        emit MintFeeSet(fee);
    }

    function withdraw(address payable to) external onlyRole(DEFAULT_ADMIN_ROLE) {
        (bool ok,) = to.call{value: address(this).balance}("");
        if (!ok) revert WithdrawFailed();
    }
}
