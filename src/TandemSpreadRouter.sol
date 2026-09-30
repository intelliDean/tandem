// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TandemOrder.sol";
import "./libraries/SpreadMath.sol";
import "./libraries/KuruAdapter.sol";
import "./libraries/PerplAdapter.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/IPerplExchangeOfficial.sol";

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

    error InsufficientQuoteBalance(uint256 available, uint256 required);
    error InsufficientMonSentToClose(uint256 sent, uint256 required);
    error TransferFailed();

    // ============ Constructor ============

    constructor(
        address _perplExchange,
        address _collateralToken,
        address _feeRecipient
    ) TandemOrder() {
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
        _pullEntryFunds(order);

        // 3. Leg 1: Spot Buy on Kuru CLOB
        (uint256 actualMonBought, uint256 actualQuoteSpent) = KuruAdapter.executeMarketBuy(
            order.kuruMarket,
            order.quoteToken,
            order.maxSpotSpend,
            order.quantity
        );

        // 4. Leg 2: Perpetual Short on Perpl DEX
        uint256 perpOrderId = _executePerplShortLeg(order, actualMonBought);

        // 5. Leg 3: Spread and Accounting Verification
        int256 actualSpread = _verifySpreadAndFees(order, actualQuoteSpent, actualMonBought);

        // 6. Settle balances: refund unspent quote & deliver purchased MON to recipient
        _settleEntryDeliveries(order, actualQuoteSpent, actualMonBought);

        result = ExecutionResult({
            orderHash: orderHash,
            spotMonReceived: actualMonBought,
            spotQuoteSpent: actualQuoteSpent,
            perpOrderId: perpOrderId,
            actualSpread: actualSpread,
            actualFee: 0
        });

        emit SpreadEntryExecuted(
            orderHash,
            order.owner,
            actualMonBought,
            actualQuoteSpent,
            perpOrderId,
            actualSpread,
            0
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

        // 2. Validate sufficient native MON sent
        uint96 kuruSize = KuruAdapter.toKuruSize(order.quantity);
        uint256 nativeSellAmount = KuruAdapter.toMonWei(kuruSize);
        if (msg.value < nativeSellAmount) {
            revert InsufficientMonSentToClose(msg.value, nativeSellAmount);
        }

        // 3. Leg 1: Sell Spot MON on Kuru CLOB
        quoteReceived = KuruAdapter.executeMarketSell(
            order.kuruMarket,
            order.quoteToken,
            order.quantity,
            order.minSpotProceeds
        );

        // 4. Leg 2: Close Short on Perpl
        uint256 lotLNS = order.perpLots > 0 ? order.perpLots : (uint256(order.quantity) / 1e13);
        perpCloseOrderId = PerplAdapter.closeShort(
            perplExchange,
            order.perpId,
            order.maxPerpClosePrice,
            lotLNS
        );

        // 5. Settle exit proceeds and refund excess native MON
        _settleExitDeliveries(order, quoteReceived);

        emit SpreadExitExecuted(
            orderHash,
            order.owner,
            order.quantity,
            quoteReceived,
            perpCloseOrderId,
            order.minExitSpread
        );
    }

    // ============ Internal Helper Functions ============

    /// @dev Pulls quote tokens and collateral from the order owner
    function _pullEntryFunds(SpreadOrder calldata order) internal {
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
            require(
                IERC20(order.quoteToken).transferFrom(order.owner, address(this), order.maxSpotSpend),
                "Spot quote transfer failed"
            );
            require(
                collateralToken.transferFrom(order.owner, address(this), order.collateral),
                "Perp collateral transfer failed"
            );
        }
    }

    /// @dev Deposits margin and opens short position on Perpl DEX
    function _executePerplShortLeg(
        SpreadOrder calldata order,
        uint256 actualMonBought
    ) internal returns (uint256 perpOrderId) {
        PerplAdapter.ensureAccountAndDeposit(perplExchange, collateralToken, order.collateral);

        uint256 lotLNS = order.perpLots > 0 ? order.perpLots : (actualMonBought / 1e13);
        perpOrderId = PerplAdapter.openShort(
            perplExchange,
            order.perpId,
            order.minPerpPrice,
            lotLNS
        );
    }

    /// @dev Computes and strictly enforces net spread conditions
    function _verifySpreadAndFees(
        SpreadOrder calldata order,
        uint256 actualQuoteSpent,
        uint256 actualMonBought
    ) internal pure returns (int256 actualSpread) {
        uint256 effectiveSpotPrice = SpreadMath.computeSpotPrice(actualQuoteSpent, actualMonBought);
        uint256 effectivePerpPrice = order.minPerpPrice;
        uint256 actualFee = 0;

        actualSpread = SpreadMath.computeAdjustedEntrySpread(
            effectivePerpPrice,
            effectiveSpotPrice,
            actualFee
        );

        SpreadMath.validateSpreadAndFees(actualSpread, order.minSpread, actualFee, order.maxFee);
    }

    /// @dev Refunds unused quote tokens and forwards native MON to recipient
    function _settleEntryDeliveries(
        SpreadOrder calldata order,
        uint256 actualQuoteSpent,
        uint256 actualMonBought
    ) internal {
        uint256 unspentQuote = order.maxSpotSpend - actualQuoteSpent;
        if (unspentQuote > 0) {
            IERC20(order.quoteToken).transfer(order.owner, unspentQuote);
        }

        address recipient = order.account != address(0) ? order.account : order.owner;
        (bool sent, ) = recipient.call{value: actualMonBought}("");
        if (!sent) revert TransferFailed();
    }

    /// @dev Transferred exit quote proceeds to recipient and refunds remaining native MON
    function _settleExitDeliveries(CloseOrder calldata order, uint256 quoteReceived) internal {
        address recipient = order.account != address(0) ? order.account : order.owner;
        IERC20(order.quoteToken).transfer(recipient, quoteReceived);

        uint256 monRemaining = address(this).balance;
        if (monRemaining > 0) {
            (bool success, ) = recipient.call{value: monRemaining}("");
            if (!success) revert TransferFailed();
        }
    }
}
