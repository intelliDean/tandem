// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IPerplExchangeOfficial.sol";
import "../interfaces/IERC20.sol";

/// @title PerplAdapter
/// @notice Dedicated adapter for executing perpetual short operations on Perpl DEX
library PerplAdapter {
    /// @notice Ensures that the calling router has an active account on Perpl and deposits collateral
    /// @param perpl Perpl exchange contract
    /// @param collateralToken Collateral token (AUSD)
    /// @param amount Amount of collateral to deposit
    function ensureAccountAndDeposit(
        IExchange perpl,
        IERC20 collateralToken,
        uint256 amount
    ) internal {
        collateralToken.approve(address(perpl), amount);

        try perpl.getAccountByAddr(address(this)) returns (IExchange.AccountInfo memory) {
            perpl.depositCollateral(amount);
        } catch {
            perpl.createAccount(amount);
        }
    }

    /// @notice Opens a perpetual short on Perpl via immediate-or-cancel market order
    /// @param perpl Perpl exchange contract
    /// @param perpId Market ID on Perpl
    /// @param minPricePNS Minimum acceptable fill price
    /// @param lotLNS Number of lots to short
    /// @return orderId ID of the executed/matched order
    function openShort(
        IExchange perpl,
        uint256 perpId,
        uint256 minPricePNS,
        uint256 lotLNS
    ) internal returns (uint256 orderId) {
        IExchange.OrderDesc memory orderDesc = IExchange.OrderDesc({
            orderDescId: 0,
            perpId: perpId,
            orderType: IExchange.OrderDescEnum.wrap(1), // OpenShort
            orderId: 0,
            pricePNS: minPricePNS,
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

        IExchange.OrderSignature memory sig = perpl.execOrder(orderDesc);
        orderId = sig.orderId;
    }

    /// @notice Closes an existing short on Perpl via immediate-or-cancel order
    /// @param perpl Perpl exchange contract
    /// @param perpId Market ID on Perpl
    /// @param maxPricePNS Maximum acceptable buy-back price
    /// @param lotLNS Number of lots to close
    /// @return orderId ID of the executed close order
    function closeShort(
        IExchange perpl,
        uint256 perpId,
        uint256 maxPricePNS,
        uint256 lotLNS
    ) internal returns (uint256 orderId) {
        IExchange.OrderDesc memory closeDesc = IExchange.OrderDesc({
            orderDescId: 0,
            perpId: perpId,
            orderType: IExchange.OrderDescEnum.wrap(3), // CloseShort
            orderId: 0,
            pricePNS: maxPricePNS,
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

        IExchange.OrderSignature memory sig = perpl.execOrder(closeDesc);
        orderId = sig.orderId;
    }
}
