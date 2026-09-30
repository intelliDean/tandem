// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/interfaces/IPerplExchangeOfficial.sol";
import "../src/interfaces/IERC20.sol";

contract PerplOfficialForkTest is Test {
    address constant PERPL_EXCHANGE = 0x34B6552d57a35a1D042CcAe1951BD1C370112a6F;
    address constant AUSD           = 0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a;

    IExchange perpl;
    IERC20 ausd;

    address trader;
    uint256 traderKey;

    function setUp() public {
        perpl = IExchange(PERPL_EXCHANGE);
        ausd = IERC20(AUSD);

        (trader, traderKey) = makeAddrAndKey("tandem_trader");
    }

    /// @notice Set AUSD balance respecting AUSD packed storage {uint8 flags; uint248 balance}
    function _dealCollateral(address to, uint256 amount) internal {
        vm.record();
        ausd.balanceOf(to);
        (bytes32[] memory reads,) = vm.accesses(address(ausd));
        bytes32 slot = reads[reads.length - 1];

        uint256 current = uint256(vm.load(address(ausd), slot));
        vm.store(address(ausd), slot, bytes32((amount << 8) | (current & 0xff)));

        require(ausd.balanceOf(to) == amount, "AUSD balance layout mismatch");
    }

    function test_GetExchangeInfo_MatchesMainnet() public view {
        (
            uint256 balanceCNS,
            uint256 protocolBalanceCNS,
            uint256 recycleBalanceCNS,
            uint256 collateralDecimals,
            address collateralToken,
            address verifierProxy
        ) = perpl.getExchangeInfo();

        assertEq(collateralToken, AUSD, "Collateral token must match AUSD");
        assertEq(collateralDecimals, 6, "Collateral decimals must be 6");
        assertGt(balanceCNS, 0, "Exchange should hold positive collateral balance");
        assertTrue(verifierProxy != address(0), "Verifier proxy must be set");

        uint256 minOpen = perpl.getMinAccountOpenCNS();
        assertEq(minOpen, 10_000_000, "Min open should be 10 AUSD");
    }

    function test_GetPerpetualMarketInfo() public {
        IExchange.PerpetualInfo memory perp = perpl.getPerpetualInfo(1);
        emit log_named_string("Market Name", perp.name);
        emit log_named_string("Market Symbol", perp.symbol);
        emit log_named_uint("Base Price PNS", perp.basePricePNS);
        emit log_named_uint("Mark Price PNS", perp.markPNS);
        emit log_named_uint("Price Decimals", perp.priceDecimals);
        emit log_named_uint("Lot Decimals", perp.lotDecimals);
        emit log_named_uint("Long OI", perp.longOpenInterestLNS);
        emit log_named_uint("Short OI", perp.shortOpenInterestLNS);

        assertTrue(bytes(perp.symbol).length > 0, "Symbol should not be empty");
    }

    function test_CreateAccount_OnChain_Fork() public {
        uint256 initialDeposit = 50_000_000; // 50 AUSD (min is 10 AUSD)
        _dealCollateral(trader, initialDeposit);
        assertEq(ausd.balanceOf(trader), initialDeposit, "Trader funded with 50 AUSD");

        vm.startPrank(trader);
        ausd.approve(PERPL_EXCHANGE, type(uint256).max);

        uint256 accountId = perpl.createAccount(initialDeposit);
        vm.stopPrank();

        emit log_named_uint("Created Perpl Account ID", accountId);
        assertGt(accountId, 0, "Account ID should be > 0");

        // Verify account on exchange
        IExchange.AccountInfo memory acct = perpl.getAccountById(accountId);
        assertEq(acct.accountId, accountId, "Account ID must match");
        assertEq(acct.accountAddr, trader, "Account owner must be trader");
        assertEq(acct.balanceCNS, initialDeposit, "Balance must match initial deposit");

        // Verify query by address
        IExchange.AccountInfo memory acctByAddr = perpl.getAccountByAddr(trader);
        assertEq(acctByAddr.accountId, accountId, "Account by addr ID must match");
    }

    function test_DepositCollateral_And_AllowOrderForwarding() public {
        uint256 initialDeposit = 20_000_000; // 20 AUSD
        uint256 secondDeposit = 30_000_000;  // 30 AUSD
        _dealCollateral(trader, initialDeposit + secondDeposit);

        vm.startPrank(trader);
        ausd.approve(PERPL_EXCHANGE, type(uint256).max);
        uint256 accountId = perpl.createAccount(initialDeposit);

        // Deposit additional collateral
        perpl.depositCollateral(secondDeposit);

        // Allow order forwarding (vital for keeper / matching engine forwarding)
        perpl.allowOrderForwarding(true);
        vm.stopPrank();

        IExchange.AccountInfo memory acct = perpl.getAccountById(accountId);
        assertEq(acct.balanceCNS, initialDeposit + secondDeposit, "Total balance should equal 50 AUSD");
    }

    function test_ExecOrder_PostOnly_OnChain_Fork() public {
        uint256 deposit = 500_000_000; // 500 AUSD
        _dealCollateral(trader, deposit);

        vm.startPrank(trader);
        ausd.approve(PERPL_EXCHANGE, type(uint256).max);
        perpl.createAccount(deposit);
        vm.stopPrank();

        // On fork, set ignOracle to true to avoid needing live Chainlink Data Streams feed signature
        address perplOwner = perpl.owner();
        vm.prank(perplOwner);
        perpl.setIgnOracle(1, true);

        IExchange.PerpetualInfo memory perp = perpl.getPerpetualInfo(1);
        uint256 bestBidPNS = perp.basePricePNS + perp.maxBidPriceONS;
        uint256 orderPrice = bestBidPNS > 10 ? bestBidPNS - 10 : perp.markPNS - 100;

        IExchange.OrderDesc memory orderDesc = IExchange.OrderDesc({
            orderDescId: 0,
            perpId: 1,
            orderType: IExchange.OrderDescEnum.wrap(0), // OpenLong
            orderId: 0,
            pricePNS: orderPrice,
            lotLNS: 10, // 0.0001 BTC
            expiryBlock: block.number + 1000,
            postOnly: true,
            fillOrKill: false,
            immediateOrCancel: false,
            maxMatches: 0,
            leverageHdths: 100, // 1x
            lastExecutionBlock: 0,
            amountCNS: 0,
            maxNegPnlCollatBPS: 0
        });

        vm.prank(trader);
        IExchange.OrderSignature memory sig = perpl.execOrder(orderDesc);

        emit log_named_uint("Placed Order ID", sig.orderId);
        emit log_named_uint("Perp ID", sig.perpId);

        assertGt(sig.orderId, 0, "Order ID should be > 0");
        assertEq(sig.perpId, 1, "Perp ID should be 1");
    }
}
