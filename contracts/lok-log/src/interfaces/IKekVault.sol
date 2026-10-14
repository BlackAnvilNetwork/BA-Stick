// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @notice DEPRECATED — KekVault is not deployed on Gnosis mainnet.
 * @dev Interface for the deprecated KEK token custody vault. See KekVault.sol and CONTRACTS.md.
 */
interface IKekVault {
    /// Pull `amount` KEK from `from` into custody. BRIDGE_ROLE only (CharacterCheckpoint).
    function deposit(address from, uint256 tokenId, uint256 amount) external;
    /// Queue a delayed withdrawal for a checkpoint-attested KEK balance decrease. BRIDGE_ROLE only.
    /// The queued amount, plus prior pending and claimed withdrawals for `tokenId`, cannot exceed that token's deposits.
    function queueWithdrawal(address to, uint256 tokenId, uint256 amount) external returns (uint256 id);
    /// Move withdrawable deposit credit from one character to another. The tokens stay in the vault.
    function reassign(uint256 fromToken, uint256 toToken, uint256 amount) external;
    /// Burn deposit credit. The tokens leave the vault and are not withdrawable by the spender.
    function sink(uint256 tokenId, uint256 amount) external;
}
