// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// ---------------------------------------------------------------------------
// IPerplExchange -- Verified interface for the Perpl perpetual exchange.
//
// Proxy:           0x34B6552d57a35a1D042CcAe1951BD1C370112a6F (Monad mainnet)
// Implementation:  0xa9Ab97A404A0bCA04d6A5b4a39995feA9E791b2A
// Chain ID:        143 (Monad mainnet)
//
// VERIFIED on-chain function signatures (confirmed via cast call probing):
//   allowOrderForwarding(bool)    0x7962f910  -> requires account to exist
//   depositCollateral(uint256)    0xbad4a01f  -> requires account to exist
//   withdraw(uint256)             0x2e1a7d4d  -> requires account to exist
//   getAccount(address)           0xfbcbc0f1  -> requires account to exist
//
// UNRESOLVED -- createAccount():
//   The function `createAccount()` (selector 0x9dca362f) reverts with empty
//   data (0x) from both the proxy and the implementation. This suggests:
//   a) Account creation requires a signed payload from the Perpl server
//      (similar to the Ed25519 key enrollment flow), OR
//   b) The function exists but has additional access control (only callable
//      via a Perpl-controlled relayer), OR
//   c) The function signature is correct but account creation is gated by
//      a non-obvious precondition (e.g., must interact via UI first).
//
// IMPLICATION FOR TANDEM:
//   On-chain account creation cannot be done atomically in the Tandem contract.
//   Users must create their Perpl account BEFORE using Tandem (one-time setup
//   via perpl.xyz UI or API). The Tandem contract can then:
//   - deposit() collateral on their behalf
//   - set allowOrderForwarding() so the Tandem executor can place orders
//   - withdraw() their funds independently
// ---------------------------------------------------------------------------

interface IPerplExchange {
    // Custom errors observed from the contract
    error AccountDoesNotExist(address account);

    // -----------------------------------------------------------------------
    // Collateral management (AUSD)
    // -----------------------------------------------------------------------

    /// @notice Deposit `amount` AUSD into the caller's Perpl exchange account.
    /// PRECONDITION: The caller must have a Perpl account (created via UI/API).
    /// Caller must have approved the exchange contract to spend `amount` AUSD.
    /// @param amount Amount in AUSD units (6 decimals on Monad).
    /// Reverts with AccountDoesNotExist if the caller has no Perpl account.
    function depositCollateral(uint256 amount) external;

    /// @notice Withdraw `amount` AUSD from the caller's Perpl exchange account.
    /// PRECONDITION: The caller must have a Perpl account and sufficient balance.
    /// @param amount Amount in AUSD units (6 decimals on Monad).
    function withdraw(uint256 amount) external;

    // -----------------------------------------------------------------------
    // Order forwarding permission
    // -----------------------------------------------------------------------

    /// @notice Enable or disable the Perpl API server's ability to place
    /// orders on behalf of the caller's account (via order forwarding).
    /// PRECONDITION: The caller must have a Perpl account.
    /// @param allow true = enable forwarding, false = disable.
    /// Reverts with AccountDoesNotExist if the caller has no Perpl account.
    function allowOrderForwarding(bool allow) external;

    // -----------------------------------------------------------------------
    // Read -- Account state
    // -----------------------------------------------------------------------

    struct AccountInfo {
        uint256 freeBalance;     // Available AUSD not in open positions
        uint256 totalBalance;    // freeBalance + position margin
        bool    orderForwarding; // Whether the Perpl server may place orders
        bool    exists;          // Whether a Perpl account exists for this address
    }

    /// @notice Read the on-chain state of a Perpl account.
    /// @param wallet The wallet/contract address to query.
    /// @return info AccountInfo struct.
    /// Note: reverts if the account does not exist.
    function getAccount(address wallet) external view returns (AccountInfo memory info);

    // -----------------------------------------------------------------------
    // Account creation -- BLOCKED (requires Perpl server signed payload)
    // -----------------------------------------------------------------------
    // createAccount() selector 0x9dca362f exists but reverts with empty data.
    // Account creation must be done via the Perpl UI or API before using Tandem.
    // Do NOT include this in the interface -- calling it will always revert.
}
