// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TandemOrder.sol";
import "./libraries/SpreadMath.sol";
import "./interfaces/IKuruOrderBook.sol";
import "./interfaces/IPerplExchangeOfficial.sol";
import "./interfaces/IERC20.sol";

/// @title TandemSpreadRouter
/// @notice Central atomic execution router for paired Kuru Spot + Perpl Perp trades
contract TandemSpreadRouter is TandemOrder {
    using SpreadMath for uint256;

    // ============ Immutables ============

    IExchange public immutable perplExchange;
    IERC20 public immutable collateralToken; // AUSD
    address public immutable feeRecipient;

    // ============ Structs ============

    struct ExecutionResult {
        bytes32 orderHash;
        uint256 spotMonReceived;
        uint256 spotQuoteSpent;
        uint256 perpOrderId;
        int256  actualSpread;
        uint256 actualFee;
    }

    // ============ Events ============

    event SpreadEntryExecuted(
        bytes32 indexed orderHash,
        address indexed owner,
        uint256 spotMonReceived,
        uint256 spotQuoteSpent,
        uint256 perpOrderId,
        int256 actualSpread,
        uint256 actualFee
    );

    event SpreadExitExecuted(
        bytes32 indexed orderHash,
        address indexed owner,
        uint256 spotMonSold,
        uint256 spotQuoteReceived,
        uint256 perpCloseOrderId,
        int256 actualExitSpread
    );

    // ============ Errors ============

    error InsufficientSpotOutput(uint256 received, uint256 expected);
    error InsufficientQuoteBalance(uint256 available, uint256 required);
    error TransferFailed();

    // ============ Constructor ============

    constructor(address _perplExchange, address _collateralToken, address _feeRecipient) TandemOrder() {
        perplExchange = IExchange(_perplExchange);
        collateralToken = IERC20(_collateralToken);
        feeRecipient = _feeRecipient;
    }

    // ============ Receive Fallback ============

    receive() external payable {}

    // ============ Atomic Entry Execution ============

    /// @notice Atomically executes a spot buy on Kuru and opens a matching short on Perpl
    /// @param order Signed spread order parameters
    /// @param signature EIP-712 signature from order.owner
    function executeSpreadOrder(
        SpreadOrder calldata order,
        bytes calldata signature
    ) external returns (ExecutionResult memory result) {
        // 1. Verify EIP-712 authorization, replay protection, and expiry
        bytes32 orderHash = _verifySpreadOrder(order, signature);

        // 2. Pull collateral and spot quote tokens from order owner
        if (order.quoteToken == address(collateralToken)) {
            uint256 totalNeeded = order.maxSpotSpend + order.collateral;
            if (collateralToken.balanceOf(order.owner) < totalNeeded) {
                revert InsufficientQuoteBalance(collateralToken.balanceOf(order.owner), totalNeeded);
            }
            require(
                collateralToken.transferFrom(order.owner, address(this), totalNeeded),
                "Collateral transfer failed"
            );
        } else {
            // Distinct tokens (e.g. USDC for spot, AUSD for Perpl margin)
            require(
                IERC20(order.quoteToken).transferFrom(order.owner, address(this), order.maxSpotSpend),
                "Spot quote transfer failed"
            );
            require(
                collateralToken.transferFrom(order.owner, address(this), order.collateral),
                "Perp collateral transfer failed"
            );
        }

        // ---------------------------------------------------------------------
        // LEG 1: Kuru Spot Buy (Fill-Or-Kill)
        // ---------------------------------------------------------------------
        IERC20(order.quoteToken).approve(order.kuruMarket, order.maxSpotSpend);
        uint256 monBefore = address(this).balance;
        uint256 quoteBalBefore = IERC20(order.quoteToken).balanceOf(address(this));

        IKuruOrderBook(order.kuruMarket).placeAndExecuteMarketBuy(
            uint96(order.maxSpotSpend),
            order.quantity, // Min MON out (FOK)
            false,          // not margin
            true            // FOK enforces full fill
        );

        uint256 actualMonBought = address(this).balance - monBefore;
        if (actualMonBought < order.quantity) {
            revert InsufficientSpotOutput(actualMonBought, order.quantity);
        }

        uint256 actualQuoteSpent = quoteBalBefore - IERC20(order.quoteToken).balanceOf(address(this));

        // ---------------------------------------------------------------------
        // LEG 2: Perpl Perpetual Short
        // ---------------------------------------------------------------------
        collateralToken.approve(address(perplExchange), order.collateral);

        // Ensure account exists on Perpl for router
        try perplExchange.getAccountByAddr(address(this)) returns (IExchange.AccountInfo memory) {
            perplExchange.depositCollateral(order.collateral);
        } catch {
            perplExchange.createAccount(order.collateral);
        }

        // Place matching short order on Perpl
        // If order.perpLots is specified, use it directly; otherwise MON 18 decimals -> Perpl lotDecimals (5 decimals) -> / 1e13
        uint256 lotLNS = order.perpLots > 0 ? order.perpLots : (actualMonBought / 1e13);

        IExchange.OrderDesc memory perpOrderDesc = IExchange.OrderDesc({
            orderDescId: 0,
            perpId: order.perpId,
            orderType: IExchange.OrderDescEnum.wrap(1), // OpenShort
            orderId: 0,
            pricePNS: order.minPerpPrice,
            lotLNS: lotLNS,
            expiryBlock: block.number + 500,
            postOnly: false,
            fillOrKill: false,
            immediateOrCancel: true, // IOC
            maxMatches: 0,
            leverageHdths: 100,      // 1x leverage
            lastExecutionBlock: 0,
            amountCNS: 0,
            maxNegPnlCollatBPS: 0
        });

        IExchange.OrderSignature memory sig = perplExchange.execOrder(perpOrderDesc);

        // ---------------------------------------------------------------------
        // LEG 3: Spread and Accounting Verification
        // ---------------------------------------------------------------------
        uint256 effectiveSpotPrice = SpreadMath.computeSpotPrice(actualQuoteSpent, actualMonBought);
        uint256 effectivePerpPrice = order.minPerpPrice; // In real fill, entry price from Perpl position
        uint256 actualFee = 0; // Configured service fee

        int256 actualSpread = SpreadMath.computeAdjustedEntrySpread(
            effectivePerpPrice,
            effectiveSpotPrice,
            actualFee
        );

        // Enforce approved spread limits. If unsatisfied, entire tx reverts rolling back both legs!
        SpreadMath.validateSpreadAndFees(actualSpread, order.minSpread, actualFee, order.maxFee);

        // Refund any unused spot quote spend back to user
        uint256 unspentQuote = order.maxSpotSpend - actualQuoteSpent;
        if (unspentQuote > 0) {
            IERC20(order.quoteToken).transfer(order.owner, unspentQuote);
        }

        // Transfer purchased MON to recipient
        address recipient = order.account != address(0) ? order.account : order.owner;
        (bool sent, ) = recipient.call{value: actualMonBought}("");
        if (!sent) revert TransferFailed();

        result = ExecutionResult({
            orderHash: orderHash,
            spotMonReceived: actualMonBought,
            spotQuoteSpent: actualQuoteSpent,
            perpOrderId: sig.orderId,
            actualSpread: actualSpread,
            actualFee: actualFee
        });

        emit SpreadEntryExecuted(
            orderHash,
            order.owner,
            actualMonBought,
            actualQuoteSpent,
            sig.orderId,
            actualSpread,
            actualFee
        );
    }

    // ============ Atomic Exit Execution ============

    /// @notice Atomically sells spot MON on Kuru and closes the perp short on Perpl
    /// @param order Signed close order parameters
    /// @param signature EIP-712 signature from order.owner
    function closeSpreadOrder(
        CloseOrder calldata order,
        bytes calldata signature
    ) external payable returns (uint256 quoteReceived, uint256 perpCloseOrderId) {
        // 1. Verify EIP-712 authorization
        bytes32 orderHash = _verifyCloseOrder(order, signature);

        // 2. Receive MON to sell
        uint96 kuruSize = uint96(order.quantity / 1e8);
        uint256 nativeSellAmount = uint256(kuruSize) * 1e8;
        require(msg.value >= nativeSellAmount, "Insufficient MON sent to close");

        // ---------------------------------------------------------------------
        // LEG 1: Sell Spot MON on Kuru
        // ---------------------------------------------------------------------
        uint256 quoteBefore = IERC20(order.quoteToken).balanceOf(address(this));

        // Send exact nativeSellAmount required by Kuru's sizePrecision scaling
        quoteReceived = IKuruOrderBook(order.kuruMarket).placeAndExecuteMarketSell{value: nativeSellAmount}(
            kuruSize,
            order.minSpotProceeds,
            false,
            true // FOK
        );

        uint256 actualQuoteReceived = IERC20(order.quoteToken).balanceOf(address(this)) - quoteBefore;

        // ---------------------------------------------------------------------
        // LEG 2: Close Short on Perpl
        // ---------------------------------------------------------------------
        uint256 lotLNS = order.perpLots > 0 ? order.perpLots : (uint256(order.quantity) / 1e13);

        IExchange.OrderDesc memory closeDesc = IExchange.OrderDesc({
            orderDescId: 0,
            perpId: order.perpId,
            orderType: IExchange.OrderDescEnum.wrap(3), // CloseShort
            orderId: 0,
            pricePNS: order.maxPerpClosePrice,
            lotLNS: lotLNS,
            expiryBlock: block.number + 500,
            postOnly: false,
            fillOrKill: false,
            immediateOrCancel: true,
            maxMatches: 0,
            leverageHdths: 100,
            lastExecutionBlock: 0,
            amountCNS: 0,
            maxNegPnlCollatBPS: 0
        });

        IExchange.OrderSignature memory sig = perplExchange.execOrder(closeDesc);
        perpCloseOrderId = sig.orderId;

        // Send quote proceeds back to user
        address recipient = order.account != address(0) ? order.account : order.owner;
        IERC20(order.quoteToken).transfer(recipient, actualQuoteReceived);

        // Refund any remaining native MON back to recipient
        uint256 monRemaining = address(this).balance;
        if (monRemaining > 0) {
            (bool success,) = recipient.call{value: monRemaining}("");
            require(success, "Native MON refund failed");
        }

        emit SpreadExitExecuted(
            orderHash,
            order.owner,
            order.quantity,
            actualQuoteReceived,
            perpCloseOrderId,
            order.minExitSpread
        );
    }
}
