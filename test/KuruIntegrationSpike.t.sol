// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/interfaces/IERC20.sol";

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

    function bestBidAsk() external view returns (uint256, uint256);
    function getMarketParams() external view returns (MarketParams memory);

    function placeAndExecuteMarketBuy(
        uint96 _quoteSize,
        uint256 _minAmountOut,
        bool _isMargin,
        bool _isFillOrKill
    ) external payable returns (uint256);

    function placeAndExecuteMarketSell(
        uint96 _size,
        uint256 _minAmountOut,
        bool _isMargin,
        bool _isFillOrKill
    ) external payable returns (uint256);
}

contract KuruIntegrationSpike is Test {
    address constant KURU_MON_AUSD = 0x131A2e70A5b31a517A74b8c567149bc294470Da9;
    address constant KURU_MON_USDC = 0x065C9d28E428A0db40191a54d33d5b7c71a9C394;
    address constant USDC          = 0x754704Bc059F8C67012fEd69BC8A327a5aafb603;
    address constant AUSD          = 0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a;

    IKuruOrderBook kuruMonAusd;
    IKuruOrderBook kuruMonUsdc;
    IERC20 usdc;
    IERC20 ausd;

    address trader;

    function setUp() public {
        kuruMonAusd = IKuruOrderBook(KURU_MON_AUSD);
        kuruMonUsdc = IKuruOrderBook(KURU_MON_USDC);
        usdc = IERC20(USDC);
        ausd = IERC20(AUSD);
        trader = makeAddr("kuru_trader");
    }

    function test_KuruMonUsdc_LiveBook() public view {
        (uint256 bestBid, uint256 bestAsk) = kuruMonUsdc.bestBidAsk();
        console.log("MON-USDC Best Bid:", bestBid);
        console.log("MON-USDC Best Ask:", bestAsk);
        assertGt(bestBid, 0, "Best bid must be > 0");
        assertGt(bestAsk, 0, "Best ask must be > 0");
        assertGt(bestAsk, bestBid, "Ask must be >= Bid");

        IKuruOrderBook.MarketParams memory p = kuruMonUsdc.getMarketParams();
        console.log("Price Precision:", p.pricePrecision);
        console.log("Size Precision:", p.sizePrecision);
        console.log("Base Decimals:", p.baseDecimals);
        console.log("Quote Decimals:", p.quoteDecimals);
        console.log("Tick Size:", p.tickSize);
        console.log("Min Size:", p.minSize);
        console.log("Max Size:", p.maxSize);
    }

    function test_KuruMarketBuy_LiveExecution_MON_USDC() public {
        uint256 spendUSDC = 50_000_000; // 50 USDC (6 decimals)
        deal(USDC, trader, spendUSDC);
        assertEq(usdc.balanceOf(trader), spendUSDC);

        vm.startPrank(trader);
        usdc.approve(KURU_MON_USDC, type(uint256).max);

        uint256 monBefore = trader.balance;
        uint256 monOut = kuruMonUsdc.placeAndExecuteMarketBuy(
            uint96(spendUSDC),
            1e18,  // expect at least 1 MON
            false, // not margin
            true   // FOK (Fill Or Kill)
        );
        vm.stopPrank();

        uint256 monAfter = trader.balance;
        console.log("Bought MON out:", monOut);
        console.log("Actual MON balance delta:", monAfter - monBefore);
        console.log("Remaining USDC:", usdc.balanceOf(trader));

        assertGt(monOut, 0, "Should have received MON");
        assertEq(monAfter - monBefore, monOut, "Native MON balance change must equal returned amount");
    }

    function test_KuruMarketSell_Probe() public {
        deal(trader, 100 ether);

        vm.startPrank(trader);
        // Try selling 1 MON with various values
        (uint256 bestBid, uint256 bestAsk) = kuruMonUsdc.bestBidAsk();
        console.log("Best Bid:", bestBid);
        console.log("Best Ask:", bestAsk);

        uint256 testVal = 1 ether;
        uint256 out = kuruMonUsdc.placeAndExecuteMarketSell{value: testVal}(
            uint96(1e10),
            1,
            false,
            true
        );
        console.log("SUCCESS! Sold 1 MON with value:", testVal);
        console.log("USDC received for 1 MON:", out);
        assertGt(out, 0, "Must receive USDC");
        vm.stopPrank();
    }
}
