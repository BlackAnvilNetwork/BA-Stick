// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// ERC-1155 of exported (tradable) items. CharacterCheckpoint holds the minter
/// capability (`Items.MINTER_ROLE` or MockItems.minters on anvil only).
///
/// Canonical ids (see `ItemIds.sol` / engine `ids.rs`):
///   fungible: keccak256(0x00 || typeId)           — catalog slug string
///   unique:   keccak256(0x01 || typeId || u64 BE) — supply 1 per instance
interface IItems {
    function mint(address to, uint256 id, uint256 amount) external;
    function burn(address from, uint256 id, uint256 amount) external;
    function balanceOf(address account, uint256 id) external view returns (uint256);
}
