// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IKuruOrderBook {
    struct MarketParams {
        uint32 pricePrecision;
        uint96 sizePrecision;
        address baseAsset;
        uint8 baseDecimals;
        address quoteAsset;
        uint8 quoteDecimals;
        uint32 tickSize;
        uint96 minSize;
        uint96 maxSize;
    }

    /// @notice Returns current best bid and ask on the book
    function bestBidAsk() external view returns (uint256 bestBid, uint256 bestAsk);

    /// @notice Returns market configuration
    function getMarketParams() external view returns (MarketParams memory);

    /// @notice Execute market buy order
    /// @param _quoteSize Amount of quote asset (e.g. USDC/AUSD) to spend
    /// @param _minAmountOut Slippage protection / min base asset to receive
    /// @param _isMargin False for spot trading
    /// @param _isFillOrKill Enforces Fill-Or-Kill (reverts if not 100% filled)
    function placeAndExecuteMarketBuy(
        uint96 _quoteSize,
        uint256 _minAmountOut,
        bool _isMargin,
        bool _isFillOrKill
    ) external payable returns (uint256 baseAmountOut);

    /// @notice Execute market sell order
    /// @param _size Amount of base asset (e.g. MON) to sell
    /// @param _minAmountOut Slippage protection / min quote asset to receive
    /// @param _isMargin False for spot trading
    /// @param _isFillOrKill Enforces Fill-Or-Kill
    function placeAndExecuteMarketSell(
        uint96 _size,
        uint256 _minAmountOut,
        bool _isMargin,
        bool _isFillOrKill
    ) external payable returns (uint256 quoteAmountOut);
}
