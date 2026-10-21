// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Test double for AhEscrow `ownerOf` payout. Not a full ERC-721.
contract MockOwnerNft {
    mapping(uint256 => address) private _owner;

    error MissingOwner();

    function setOwner(uint256 tokenId, address owner_) external {
        _owner[tokenId] = owner_;
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address o = _owner[tokenId];
        if (o == address(0)) revert MissingOwner();
        return o;
    }
}
