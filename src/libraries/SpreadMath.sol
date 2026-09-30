// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SpreadMath
/// @notice Precision and spread calculation library for Tandem Spread Orders
library SpreadMath {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant PRICE_SCALE = 1e6; // AUSD/USDC 6-decimal standard

    error SpreadBelowMinimum(int256 actualSpread, int256 minSpread);
    error FeeExceedsMaximum(uint256 actualFee, uint256 maxFee);
    error ZeroQuantity();

    /// @notice Computes effective spot price in 1e6 precision (Quote per Base)
    /// @param quoteSpent Amount of quote token (6 decimals) spent
    /// @param baseReceived Amount of base token (18 decimals) received
    function computeSpotPrice(uint256 quoteSpent, uint256 baseReceived) internal pure returns (uint256) {
        if (baseReceived == 0) revert ZeroQuantity();
        // (quoteSpent * 1e18) / baseReceived gives quote in 1e6 precision because quoteSpent is in 1e6
        return (quoteSpent * WAD) / baseReceived;
    }

    /// @notice Computes adjusted entry spread: Perp Price - Spot Price - Fee Per Unit
    /// @param perpPrice Effective perp entry price in 1e6
    /// @param spotPrice Effective spot entry price in 1e6
    /// @param feePerUnit Total fees per unit of base asset in 1e6
    /// @return adjustedSpread Signed spread value in 1e6
    function computeAdjustedEntrySpread(
        uint256 perpPrice,
        uint256 spotPrice,
        uint256 feePerUnit
    ) internal pure returns (int256 adjustedSpread) {
        adjustedSpread = int256(perpPrice) - int256(spotPrice) - int256(feePerUnit);
    }

    /// @notice Verifies that actual spread and fees satisfy the user's signed limits
    /// @param actualSpread Computed adjusted spread
    /// @param minSpread Minimum acceptable spread signed by user
    /// @param actualFee Total fees charged
    /// @param maxFee Maximum fee signed by user
    function validateSpreadAndFees(
        int256 actualSpread,
        int256 minSpread,
        uint256 actualFee,
        uint256 maxFee
    ) internal pure {
        if (actualFee > maxFee) {
            revert FeeExceedsMaximum(actualFee, maxFee);
        }
        if (actualSpread < minSpread) {
            revert SpreadBelowMinimum(actualSpread, minSpread);
        }
    }
}
