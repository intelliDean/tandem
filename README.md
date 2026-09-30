# Tandem Spread Orders

> **Atomic Paired Trading on Monad**  
> Buy spot MON on Kuru CLOB and open a matching MON perpetual short on Perpl DEX in a single, rollback-guaranteed transaction.

---

## 1. Problem Statement

Executing multi-leg trades across separate venues presents acute execution risk for traders:
- **Legging-in Risk:** An asynchronous bot may buy spot on Kuru, only for the short order on Perpl to fail due to slippage, oracle drift, or margin exhaustion—leaving the trader naked long in volatile market conditions.
- **Worse Combined Execution:** Separate executions frequently lead to negative net spreads where entry fees and price impact exceed the intended yield.

**Tandem eliminates this risk completely.** Both trades must satisfy the user-approved net spread conditions in a single transaction, or the EVM rolls back all state changes atomically: **0 MON bought, 0 quote spent, 0 perp lots opened.**

---

## 2. Architecture & Core Contracts

```
                +------------------------------------+
                |       Trader (EOA / Wallet)        |
                +-----------------+------------------+
                                  |
                   Signs EIP-712  |  Submits directly ("Execute Now")
                   SpreadOrder    |  OR submits to Executor ("Limit Spread")
                                  v
                +------------------------------------+
                |        TandemSpreadRouter          |
                |  (Atomic Multi-Leg Orchestrator)   |
                +--------+------------------+--------+
                         |                  |
           LEG 1 (Spot)  |                  |  LEG 2 (Perp Short)
                         v                  v
                +-----------------+  +-----------------+
                | Kuru OrderBook  |  | Perpl DEX       |
                | (CLOB)          |  | (Isolated Perp) |
                +-----------------+  +-----------------+
                         |                  |
                         +--------+---------+
                                  |
                                  v
                    [Verify Net Spread Threshold]
                    Actual Spread >= Min Spread ?
                           /          \
                    (YES) /            \ (NO)
                         v              v
                  [Commit Both]    [Rollback Tx]
```

### Core Contracts (`src/`)
- [`src/TandemOrder.sol`](file:///mnt/data/Projects/tandem/src/TandemOrder.sol): EIP-712 typed data hashing and signature verification for `SpreadOrder` and `CloseOrder`, with on-chain nonce invalidation and replay protection.
- [`src/TandemSpreadRouter.sol`](file:///mnt/data/Projects/tandem/src/TandemSpreadRouter.sol): The atomic router contract executing spot market buys on Kuru and opening short positions on Perpl in one atomic call. Enforces spread conditions, slippage limits, and paired closing.

---

## 3. Mathematical Spread Specification

The net adjusted entry spread is defined consistently in quote units (USDC/AUSD, 6 decimals) per 1.0 MON (18 decimals):

$$\text{Adjusted Entry Spread} = \text{Perp Price} - \text{Spot Price} - \text{Fees per MON}$$

Where:
- $\text{Spot Price} = \frac{\text{Actual Quote Spent} \times 10^{18}}{\text{Spot MON Received}}$
- $\text{Fees per MON} = \frac{\text{Total Fees} \times 10^{18}}{\text{Spot MON Received}}$
- Conservative integer division is used to prevent over-estimating spread yields.

---

## 4. Reproducible Verification (Foundry Tests)

All tests are executed against the official Monad Mainnet fork pinned at block **`109312895`** to guarantee 100% deterministic reproducibility against real deployed contracts and live liquidity:

```bash
# Run the complete test suite against pinned Monad fork
forge test --fork-url https://rpc.monad.xyz --fork-block-number 109312895 -v
```

### Verified Test Cases:
1. `test_ExecuteSpreadOrder_FullAtomicSuccess`: Complete paired execution (bought 3.649 MON on Kuru, opened 100-lot short on Perpl, spent 0.1 USDC, refunded remaining quote, verified on-chain position).
2. `test_CloseSpreadOrder_PairedExit`: Paired exit (sells spot MON on Kuru and closes perp short on Perpl in 1 atomic tx).
3. `test_SpreadRejection_RollsBackTransaction`: Rollback verification when spread condition fails (trader balance and state remain untouched).
4. `test_CancelNonce_PreventsExecution`: On-chain nonce cancellation prevents unauthorized or stale fills.
5. `test_SignatureVerification_Valid`: EIP-712 recovery with valid trader signature.
6. `test_SignatureVerification_InvalidSignerReverts`: Rejection of unauthorized signers.
7. `test_ExpiredOrder_Reverts`: Explicit rejection of orders past `order.expiry`.
8. `test_ReplayAttack_Reverts`: Replay attack protection ensuring an order cannot be executed twice.

### Live End-to-End Integration Flow (`pnpm test:e2e`)

The repository includes a runnable live end-to-end integration flow ([`services/executor/src/e2e-flow.ts`](file:///mnt/data/Projects/tandem/services/executor/src/e2e-flow.ts)) testing the full paired trading cycle:
1. Connects to the network and queries trader pre-trade balances (MON, USDC, AUSD).
2. Reads the live best bid & ask from the **Kuru MON-USDC CLOB** orderbook.
3. Constructs typed `SpreadOrder` parameters.
4. Signs the order with **EIP-712** using the trader's private key.
5. Simulates atomic paired execution on-chain via `eth_call`.
6. Broadcasts the transaction to [`TandemSpreadRouter`](file:///mnt/data/Projects/tandem/src/TandemSpreadRouter.sol).
7. Verifies post-trade settlement: Spot MON acquired (+3.65 MON), Perpl perpetual short opened, quote spent, and on-chain nonce marked.
8. Verifies atomic rollback: tests an unmeetable spread condition and confirms transaction reverts cleanly with `0xf91fdddb` (retaining full funds).

```bash
pnpm test:e2e
```

---

## 5. TypeScript SDK Usage

```typescript
import { signSpreadOrder, calculateAdjustedEntrySpread, CONTRACT_ADDRESSES } from '@tandem/sdk';

// 1. Prepare user spread order
const order = {
  owner: traderAddress,
  account: traderAddress,
  nonce: 101n,
  expiry: BigInt(Math.floor(Date.now() / 1000) + 3600),
  kuruMarket: CONTRACT_ADDRESSES.KURU_MON_USDC,
  quoteToken: CONTRACT_ADDRESSES.USDC,
  perpId: 1n,
  quantity: 10n ** 18n, // 1 MON
  perpLots: 100n,
  maxSpotSpend: 10_000_000n, // 10 USDC
  minPerpPrice: 800000n,
  collateral: 500_000_000n, // 500 AUSD
  minSpread: 500_000n, // +0.50 AUSD/MON
  maxFee: 5_000_000n,
};

// 2. Sign with connected wallet via EIP-712
const signature = await signSpreadOrder(walletClient, account, order, routerAddress, 143);
```

---

## 6. Quickstart

### 1. Build Contracts & SDK
```bash
# Install dependencies
pnpm install

# Build Foundry contracts
forge build

# Build TypeScript SDK & services
pnpm build
```

### 2. Start Background Executor
```bash
pnpm dev:executor
```

### 3. Launch Web Trading Terminal
```bash
pnpm dev:web
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 7. Monad Metropolis Deployment Addresses

| Component | Network | Contract Address | Notes / Explorer |
| :--- | :--- | :--- | :--- |
| **TandemSpreadRouter** | **Monad Testnet (10143)** | `0xC7885f87e2027F90D8cd4372CE5071b3aFE19E91` | **Live Onchain** • Block `66981631` • Tx: `0xaee18e5f...b425282` |
| **Deployer Wallet** | Monad Testnet (10143) | `0xB99DF9c70a4bA401CCc32DEBa43393905C80294C` | Verified Deployer & Fee Recipient |
| **Kuru MON-USDC Market** | Monad (143) | `0x065C9d28E428A0db40191a54d33d5b7c71a9C394` | Live CLOB OrderBook |
| **Perpl Exchange Proxy** | Monad (143) | `0x34B6552d57a35a1D042CcAe1951BD1C370112a6F` | Isolated Perpetual DEX Engine |
| **USDC** | Monad (143) | `0x754704Bc059F8C67012fEd69BC8A327a5aafb603` | Spot Quote Asset |
| **AUSD** | Monad (143) | `0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a` | Perpetual Margin Asset |

