// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// ---------------------------------------------------------------------------
// IKuruRouter — Minimal interface for the Kuru Market Factory / Router.
//
// Router (Market Factory): 0xd651346d7c789536ebf06dc72aE3C8502cd695CC (Monad mainnet)
// KuruFlowEntrypoint:      0xb3e6778480b2E488385E8205eA05E20060B813cb (Aggregator)
// WMON:                    0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A
//
// Kuru is a fully on-chain CLOB. All order placement is via direct contract
// calls — there is no off-chain API requirement for order execution.
// ---------------------------------------------------------------------------

interface IKuruRouter {
    // -----------------------------------------------------------------------
    // Market-order swap (simplest path — uses best-price routing)
    // -----------------------------------------------------------------------

    /// @notice Swap exact amount of tokenIn for at least minAmountOut of tokenOut.
    /// Reverts if the fill would result in less than minAmountOut (FOK semantics).
    /// @param tokenIn  Address of the token to sell (use address(0) for native MON).
    /// @param tokenOut Address of the token to buy.
    /// @param amountIn Exact amount of tokenIn to sell.
    /// @param minAmountOut Minimum acceptable output — order reverts if not met.
    /// @return amountOut Actual amount of tokenOut received.
    function swapExactIn(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) external payable returns (uint256 amountOut);

    // -----------------------------------------------------------------------
    // Quote (read-only, for simulation)
    // -----------------------------------------------------------------------

    /// @notice Quote the output for a given input without executing.
    /// @param tokenIn  Address of the token to sell.
    /// @param tokenOut Address of the token to buy.
    /// @param amountIn Amount of tokenIn.
    /// @return amountOut Expected output of tokenOut.
    function quoteExactIn(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut);
}

// ---------------------------------------------------------------------------
// IWMON — Wrapped MON interface (ERC-20 + deposit/withdraw)
// ---------------------------------------------------------------------------
interface IWMON {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function decimals() external view returns (uint8);
}
