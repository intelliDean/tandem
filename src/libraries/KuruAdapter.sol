// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IKuruOrderBook.sol";
import "../interfaces/IERC20.sol";

/// @title KuruAdapter
/// @notice Dedicated adapter for executing spot market orders on Kuru CLOB
library KuruAdapter {
    uint256 internal constant KURU_SIZE_DIVISOR = 1e8; // Converts 18-decimal wei to Kuru 10-decimal size units

    error InsufficientSpotOutput(uint256 received, uint256 expected);
    error NativeMonSellFailed();

    /// @notice Converts native MON wei (18 decimals) to Kuru size units
    /// @param monWei Quantity in wei
    /// @return kuruSize Scaled size units accepted by Kuru orderbook
    function toKuruSize(uint256 monWei) internal pure returns (uint96 kuruSize) {
        kuruSize = uint96(monWei / KURU_SIZE_DIVISOR);
    }

    /// @notice Converts Kuru size units back to native MON wei
    /// @param kuruSize Size in Kuru units
    /// @return monWei Native MON wei
    function toMonWei(uint96 kuruSize) internal pure returns (uint256 monWei) {
        monWei = uint256(kuruSize) * KURU_SIZE_DIVISOR;
    }

    /// @notice Executes a Fill-Or-Kill spot market buy on Kuru CLOB
    /// @param kuruMarket Address of Kuru OrderBook contract
    /// @param quoteToken Address of quote ERC20 token (USDC / AUSD)
    /// @param maxQuoteSpend Maximum quote tokens to spend
    /// @param minMonOut Minimum native MON to receive
    /// @return monBought Actual native MON received
    /// @return quoteSpent Actual quote tokens spent
    function executeMarketBuy(
        address kuruMarket,
        address quoteToken,
        uint256 maxQuoteSpend,
        uint256 minMonOut
    ) internal returns (uint256 monBought, uint256 quoteSpent) {
        IERC20(quoteToken).approve(kuruMarket, maxQuoteSpend);

        uint256 monBefore = address(this).balance;
        uint256 quoteBefore = IERC20(quoteToken).balanceOf(address(this));

        IKuruOrderBook(kuruMarket).placeAndExecuteMarketBuy(
            uint96(maxQuoteSpend),
            minMonOut,
            false, // not margin
            true   // FOK enforces full fill
        );

        monBought = address(this).balance - monBefore;
        if (monBought < minMonOut) {
            revert InsufficientSpotOutput(monBought, minMonOut);
        }

        quoteSpent = quoteBefore - IERC20(quoteToken).balanceOf(address(this));
    }

    /// @notice Executes a Fill-Or-Kill spot market sell of native MON on Kuru CLOB
    /// @param kuruMarket Address of Kuru OrderBook contract
    /// @param quoteToken Address of quote ERC20 token to receive
    /// @param monQuantity Native MON wei to sell
    /// @param minQuoteProceeds Minimum quote tokens to receive
    /// @return quoteReceived Actual quote tokens received from the sale
    function executeMarketSell(
        address kuruMarket,
        address quoteToken,
        uint256 monQuantity,
        uint256 minQuoteProceeds
    ) internal returns (uint256 quoteReceived) {
        uint96 kuruSize = toKuruSize(monQuantity);
        uint256 nativeSellAmount = toMonWei(kuruSize);

        uint256 quoteBefore = IERC20(quoteToken).balanceOf(address(this));

        IKuruOrderBook(kuruMarket).placeAndExecuteMarketSell{value: nativeSellAmount}(
            kuruSize,
            minQuoteProceeds,
            false, // not margin
            true   // FOK
        );

        quoteReceived = IERC20(quoteToken).balanceOf(address(this)) - quoteBefore;
    }
}
