// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
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
///         Prefer `createCharacterFor(job, expectedTokenId)` so the chain id matches the log token.
///         Plain `createCharacter` remains for scripts that do not care about a pre-assigned id.
contract CharacterFactory is Initializable, AccessControlUpgradeable, UUPSUpgradeable {
    // NOTE: append-only.
    ICharacterMint public nft;
    ICharacterInit public state;
    mapping(uint8 => bool) public isStartingJob;
    uint256 public mintFee;

    event CharacterCreated(address indexed player, uint256 indexed tokenId, uint8 startingJob);
    event MintFeeSet(uint256 fee);
    event StartingJobSet(uint8 indexed job, bool ok);

    error WrongFee();
    error BadJob();
    error WrongTokenId();
    error WithdrawFailed();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, address nft_, address state_, uint256 mintFee_) external initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, admin); // multisig
        nft = ICharacterMint(nft_);
        state = ICharacterInit(state_);
        mintFee = mintFee_; // 0.001 ether at launch
        emit MintFeeSet(mintFee_);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    /// @notice Mint the next id to `msg.sender`. Prefer `createCharacterFor` when the log already
    ///         assigned a token id so payers cannot claim someone else's character NFT.
    function createCharacter(uint8 startingJob) external payable returns (uint256 tokenId) {
        if (msg.value != mintFee) revert WrongFee();
        if (!isStartingJob[startingJob]) revert BadJob();
        tokenId = nft.mint(msg.sender);
        state.initCharacter(tokenId, startingJob);
        emit CharacterCreated(msg.sender, tokenId, startingJob);
    }

    /// @notice Mint exactly `expectedTokenId` (must be `nextTokenId + 1`) to `msg.sender`.
    ///         Binds payment to the log character that already reserved that id.
    function createCharacterFor(uint8 startingJob, uint256 expectedTokenId) external payable returns (uint256 tokenId) {
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
        mintFee = fee;
        emit MintFeeSet(fee);
    }

    function withdraw(address payable to) external onlyRole(DEFAULT_ADMIN_ROLE) {
        (bool ok,) = to.call{value: address(this).balance}("");
        if (!ok) revert WithdrawFailed();
    }
}
