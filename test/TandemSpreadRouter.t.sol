// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/TandemSpreadRouter.sol";
import "../src/interfaces/IKuruOrderBook.sol";
import "../src/interfaces/IPerplExchangeOfficial.sol";
import "../src/interfaces/IERC20.sol";

contract TandemSpreadRouterTest is Test {
    address constant PERPL_EXCHANGE = 0x34B6552d57a35a1D042CcAe1951BD1C370112a6F;
    address constant KURU_MON_AUSD  = 0x131A2e70A5b31a517A74b8c567149bc294470Da9;
    address constant KURU_MON_USDC  = 0x065C9d28E428A0db40191a54d33d5b7c71a9C394;
    address constant AUSD           = 0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a;
    address constant USDC           = 0x754704Bc059F8C67012fEd69BC8A327a5aafb603;

    TandemSpreadRouter router;
    IExchange perpl;
    IERC20 ausd;

    address trader;
    uint256 traderKey;
    address feeRecipient;

    function setUp() public {
        perpl = IExchange(PERPL_EXCHANGE);
        ausd = IERC20(AUSD);
        feeRecipient = makeAddr("feeRecipient");

        (trader, traderKey) = makeAddrAndKey("trader");

        router = new TandemSpreadRouter(PERPL_EXCHANGE, AUSD, feeRecipient);
    }

    function _dealCollateral(address to, uint256 amount) internal {
        vm.record();
        ausd.balanceOf(to);
        (bytes32[] memory reads,) = vm.accesses(address(ausd));
        bytes32 slot = reads[reads.length - 1];

        uint256 current = uint256(vm.load(address(ausd), slot));
        vm.store(address(ausd), slot, bytes32((amount << 8) | (current & 0xff)));

        require(ausd.balanceOf(to) == amount, "AUSD balance layout mismatch");
    }

    function _signOrder(TandemOrder.SpreadOrder memory order, uint256 key) internal view returns (bytes memory) {
        bytes32 digest = router.hashSpreadOrder(order);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function _signCloseOrder(TandemOrder.CloseOrder memory order, uint256 key) internal view returns (bytes memory) {
        bytes32 digest = router.hashCloseOrder(order);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    // =========================================================================
    // 1. EIP-712 Signature & Nonce Tests
    // =========================================================================

    function test_SignatureVerification_Valid() public view {
        TandemOrder.SpreadOrder memory order = TandemOrder.SpreadOrder({
            owner: trader,
            account: trader,
            nonce: 1,
            expiry: block.timestamp + 1 hours,
            kuruMarket: KURU_MON_AUSD,
            quoteToken: AUSD,
            perpId: 1,
            quantity: 1e18,
            perpLots: 100,
            maxSpotSpend: 100e6,
            minPerpPrice: 800000,
            collateral: 50e6,
            minSpread: 0,
            maxFee: 1e6
        });

        bytes memory sig = _signOrder(order, traderKey);
        bytes32 orderHash = router.hashSpreadOrder(order);
        address recovered = ECDSA.recover(orderHash, sig);
        assertEq(recovered, trader, "Signature must recover trader");
    }

    function test_SignatureVerification_InvalidSignerReverts() public {
        TandemOrder.SpreadOrder memory order = TandemOrder.SpreadOrder({
            owner: trader,
            account: trader,
            nonce: 1,
            expiry: block.timestamp + 1 hours,
            kuruMarket: KURU_MON_AUSD,
            quoteToken: AUSD,
            perpId: 1,
            quantity: 1e18,
            perpLots: 100,
            maxSpotSpend: 100e6,
            minPerpPrice: 800000,
            collateral: 50e6,
            minSpread: 0,
            maxFee: 1e6
        });

        // Sign with wrong key
        (, uint256 attackerKey) = makeAddrAndKey("attacker");
        bytes memory badSig = _signOrder(order, attackerKey);

        _dealCollateral(trader, 200e6);
        vm.prank(trader);
        ausd.approve(address(router), type(uint256).max);

        vm.expectRevert();
        router.executeSpreadOrder(order, badSig);
    }

    function test_CancelNonce_PreventsExecution() public {
        TandemOrder.SpreadOrder memory order = TandemOrder.SpreadOrder({
            owner: trader,
            account: trader,
            nonce: 42,
            expiry: block.timestamp + 1 hours,
            kuruMarket: KURU_MON_AUSD,
            quoteToken: AUSD,
            perpId: 1,
            quantity: 1e18,
            perpLots: 100,
            maxSpotSpend: 100e6,
            minPerpPrice: 800000,
            collateral: 50e6,
            minSpread: 0,
            maxFee: 1e6
        });

        bytes memory sig = _signOrder(order, traderKey);

        // Cancel nonce 42
        vm.prank(trader);
        router.cancelNonce(42);
        assertTrue(router.isNonceCancelled(trader, 42), "Nonce 42 must be cancelled");

        _dealCollateral(trader, 200e6);
        vm.prank(trader);
        ausd.approve(address(router), type(uint256).max);

        vm.expectRevert();
        router.executeSpreadOrder(order, sig);
    }

    // =========================================================================
    // 2. Spread Rejection & Rollback Tests
    // =========================================================================

    function test_SpreadRejection_RollsBackTransaction() public {
        // Require an impossibly high spread (e.g. +$100,000)
        TandemOrder.SpreadOrder memory order = TandemOrder.SpreadOrder({
            owner: trader,
            account: trader,
            nonce: 100,
            expiry: block.timestamp + 1 hours,
            kuruMarket: KURU_MON_AUSD,
            quoteToken: AUSD,
            perpId: 1,
            quantity: 1e18,
            perpLots: 100,
            maxSpotSpend: 10e6,
            minPerpPrice: 1000,
            collateral: 20e6,
            minSpread: 100_000e6, // +100k spread required!
            maxFee: 1e6
        });

        bytes memory sig = _signOrder(order, traderKey);

        uint256 initialBal = 50e6;
        _dealCollateral(trader, initialBal);
        vm.prank(trader);
        ausd.approve(address(router), type(uint256).max);

        // Attempt execution: spread check fails -> reverts
        vm.expectRevert();
        router.executeSpreadOrder(order, sig);

        // Verify full rollback: trader balance untouched, no open order
        assertEq(ausd.balanceOf(trader), initialBal, "Trader balance must remain fully intact on rollback");
        assertFalse(router.isOrderExecuted(router.hashSpreadOrder(order)), "Order must not be marked executed");
    }

    // =========================================================================
    // 3. Full Atomic Execution Test (Both Legs Succeed)
    // =========================================================================

    function test_ExecuteSpreadOrder_FullAtomicSuccess() public {
        address perplOwner = perpl.owner();
        vm.prank(perplOwner);
        perpl.setIgnOracle(1, true);

        // Trader authorizes spread order: buy MON on Kuru with USDC, open short on Perpl with AUSD
        TandemOrder.SpreadOrder memory order = TandemOrder.SpreadOrder({
            owner: trader,
            account: trader,
            nonce: 200,
            expiry: block.timestamp + 1 hours,
            kuruMarket: KURU_MON_USDC,
            quoteToken: USDC,
            perpId: 1,
            quantity: 1e18, // Expect at least 1 MON
            perpLots: 100,  // Short 100 lots on Perpl (matches resting book liquidity)
            maxSpotSpend: 10e6, // 10 USDC
            minPerpPrice: 800000,
            collateral: 500e6, // 500 AUSD Collateral for Perpl
            minSpread: -100_000e6, // Generous floor for probe
            maxFee: 5e6
        });

        bytes memory sig = _signOrder(order, traderKey);

        // Fund trader with USDC and AUSD
        deal(USDC, trader, 10e6);
        _dealCollateral(trader, 500e6);

        vm.startPrank(trader);
        IERC20(USDC).approve(address(router), type(uint256).max);
        ausd.approve(address(router), type(uint256).max);

        uint256 monBefore = trader.balance;

        // Execute atomically through router
        TandemSpreadRouter.ExecutionResult memory res = router.executeSpreadOrder(order, sig);
        vm.stopPrank();

        uint256 monAfter = trader.balance;

        emit log_named_bytes32("Order Hash", res.orderHash);
        emit log_named_uint("Perp Order ID", res.perpOrderId);
        emit log_named_uint("Spot MON Received", res.spotMonReceived);
        emit log_named_uint("Spot Quote Spent", res.spotQuoteSpent);
        emit log_named_int("Actual Spread", res.actualSpread);

        assertGt(res.spotMonReceived, 0, "Spot MON received must be > 0");
        assertEq(monAfter - monBefore, res.spotMonReceived, "Trader native MON delta must match received");
        assertTrue(router.isOrderExecuted(res.orderHash), "Order must be marked executed");
        assertTrue(router.isNonceCancelled(trader, 200), "Nonce 200 must be marked used");

        // Verify Perpl on-chain position directly
        IExchange.AccountInfo memory routerAcct = perpl.getAccountByAddr(address(router));
        (IExchange.PositionInfo memory pos,,) = perpl.getPosition(order.perpId, routerAcct.accountId);
        assertEq(pos.lotLNS, 100, "Perp short position must have exactly 100 lots");
        assertEq(uint8(IExchange.PositionEnum.unwrap(pos.positionType)), 1, "Position must be short (1)");
    }

    // =========================================================================
    // 4. Paired Exit Test (Spot Sale + Perp Short Close)
    // =========================================================================

    function test_CloseSpreadOrder_PairedExit() public {
        // 1. First execute spread entry
        test_ExecuteSpreadOrder_FullAtomicSuccess();

        // 2. Prepare CloseOrder for 1 MON
        TandemOrder.CloseOrder memory closeOrder = TandemOrder.CloseOrder({
            owner: trader,
            account: trader,
            nonce: 300,
            expiry: block.timestamp + 1 hours,
            kuruMarket: KURU_MON_USDC,
            quoteToken: USDC,
            perpId: 1,
            quantity: 1e18, // Sell 1 MON
            perpLots: 100,  // Close the 100-lot short
            minSpotProceeds: 10_000, // At least 0.01 USDC
            maxPerpClosePrice: 900000, // Willing to buy back up to $90,000
            minExitSpread: -100_000e6
        });

        bytes memory sig = _signCloseOrder(closeOrder, traderKey);

        uint256 usdcBefore = IERC20(USDC).balanceOf(trader);

        // Trader calls closeSpreadOrder with 1 MON + fee buffer in native value
        vm.prank(trader);
        (uint256 quoteReceived, uint256 closeOrderId) = router.closeSpreadOrder{value: 1.01 ether}(closeOrder, sig);

        uint256 usdcAfter = IERC20(USDC).balanceOf(trader);

        emit log_named_uint("Quote Received from Exit", quoteReceived);
        emit log_named_uint("Perp Close Order ID", closeOrderId);

        assertGt(quoteReceived, 0, "Spot sale quote proceeds must be > 0");
        assertEq(usdcAfter - usdcBefore, quoteReceived, "Trader USDC balance delta must match proceeds");
        assertTrue(router.isOrderExecuted(router.hashCloseOrder(closeOrder)), "Close order must be marked executed");
        assertTrue(router.isNonceCancelled(trader, 300), "Nonce 300 must be cancelled");
    }

    // =========================================================================
    // 5. Security & Edge Case Tests
    // =========================================================================

    function test_ExpiredOrder_Reverts() public {
        TandemOrder.SpreadOrder memory order = TandemOrder.SpreadOrder({
            owner: trader,
            account: trader,
            nonce: 501,
            expiry: block.timestamp - 1, // Already expired
            kuruMarket: KURU_MON_USDC,
            quoteToken: USDC,
            perpId: 1,
            quantity: 1e18,
            perpLots: 100,
            maxSpotSpend: 10e6,
            minPerpPrice: 800000,
            collateral: 500e6,
            minSpread: -100_000e6,
            maxFee: 5e6
        });

        bytes memory sig = _signOrder(order, traderKey);

        deal(USDC, trader, 10e6);
        _dealCollateral(trader, 500e6);

        vm.startPrank(trader);
        IERC20(USDC).approve(address(router), type(uint256).max);
        ausd.approve(address(router), type(uint256).max);

        vm.expectRevert(
            abi.encodeWithSelector(TandemOrder.OrderExpired.selector, order.expiry, block.timestamp)
        );
        router.executeSpreadOrder(order, sig);
        vm.stopPrank();
    }

    function test_ReplayAttack_Reverts() public {
        address perplOwner = perpl.owner();
        vm.prank(perplOwner);
        perpl.setIgnOracle(1, true);

        TandemOrder.SpreadOrder memory order = TandemOrder.SpreadOrder({
            owner: trader,
            account: trader,
            nonce: 502,
            expiry: block.timestamp + 1 hours,
            kuruMarket: KURU_MON_USDC,
            quoteToken: USDC,
            perpId: 1,
            quantity: 1e18,
            perpLots: 100,
            maxSpotSpend: 10e6,
            minPerpPrice: 800000,
            collateral: 500e6,
            minSpread: -100_000e6,
            maxFee: 5e6
        });

        bytes memory sig = _signOrder(order, traderKey);

        deal(USDC, trader, 20e6);
        _dealCollateral(trader, 1000e6);

        vm.startPrank(trader);
        IERC20(USDC).approve(address(router), type(uint256).max);
        ausd.approve(address(router), type(uint256).max);

        // 1st execution succeeds
        router.executeSpreadOrder(order, sig);

        // 2nd execution (replay) MUST revert with NonceAlreadyUsedOrCancelled
        vm.expectRevert(
            abi.encodeWithSelector(TandemOrder.NonceAlreadyUsedOrCancelled.selector, trader, 502)
        );
        router.executeSpreadOrder(order, sig);
        vm.stopPrank();
    }
}
