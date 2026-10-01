# Tandem Spread Orders

> **Atomic Paired Trading on Monad**  
> Buy spot MON on Kuru CLOB and open a matching MON perpetual short on Perpl DEX in a single, rollback-guaranteed transaction.

[![Monad Metropolis](https://img.shields.io/badge/Hackathon-Monad%20Metropolis-836EF9?style=for-the-badge)](https://monad.xyz)
[![Track](https://img.shields.io/badge/Track-Onchain%20Finance%20%26%20Trading-00F0FF?style=for-the-badge)](https://monad.xyz)
[![Atomic Guarantee](https://img.shields.io/badge/Safety-100%25%20Atomic%20Rollback-00FF88?style=for-the-badge)](file:///mnt/data/Projects/tandem/src/TandemSpreadRouter.sol)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](file:///mnt/data/Projects/tandem/LICENSE)

---

## 1. Executive Summary & Problem Statement

Executing multi-leg basis trades, cash-and-carry arbitrages, or delta-neutral spreads across separate venues introduces severe execution risks for on-chain traders:

1. **Legging-in Risk:** An asynchronous execution bot may successfully purchase spot MON on Kuru, only for the subsequent hedge order on Perpl to fail due to price slippage, stale oracle feeds, congestion, or insufficient margin. This leaves the trader naked long in volatile market conditions.
2. **Execution Degradation & Adverse Spread:** Uncoordinated asynchronous fills frequently result in negative net spreads where entry fees, gas overhead, and orderbook price impact exceed the anticipated basis yield.
3. **Execution Dependency Risk:** Centralized off-chain bots can lock funds or abandon half-filled positions if the service crashes mid-flight.

### The Tandem Solution

**Tandem completely eliminates legging-in risk through EVM-level atomicity.**  
Both legs—the spot market purchase on Kuru CLOB and the isolated margin short on Perpl DEX—are executed in a single atomic transaction orchestrated by [`TandemSpreadRouter.sol`](file:///mnt/data/Projects/tandem/src/TandemSpreadRouter.sol).

$$\textbf{Strict Invariant: } \text{Both trades satisfy the approved net spread conditions in 1 tx, or neither commits.}$$

If either venue reverts, or if the net executed spread after all fees fails to meet the user's signed threshold:
$$\textbf{0 MON bought} \quad\bullet\quad \textbf{0 quote spent} \quad\bullet\quad \textbf{0 perp lots opened} \quad\bullet\quad \textbf{100\% funds retained.}$$

---

## 2. Architecture & Protocol Mechanics

```
                 +------------------------------------------------------+
                 |                Trader (EOA / Wallet)                 |
                 +--------------------------+---------------------------+
                                            |
                       Signs EIP-712        |  Direct On-Chain Call ("Execute Now")
                       Spread / Close Order |  OR Submits to Relayer ("Limit Spread")
                                            v
                 +------------------------------------------------------+
                 |                 TandemSpreadRouter                   |
                 |          (Atomic Multi-Leg Orchestrator)             |
                 +------------+----------------------------+------------+
                              |                            |
                LEG 1: Spot   |                            |  LEG 2: Perp Short
                              v                            v
                     +-----------------+          +-----------------+
                     | Kuru OrderBook  |          | Perpl DEX       |
                     | (Central CLOB)  |          | (Isolated Perp) |
                     +-----------------+          +-----------------+
                              |                            |
                              +-------------+--------------+
                                            |
                                            v
                              [Evaluate Net Executed Spread]
                              Actual Spread >= Min Spread ?
                                     /             \
                             (YES)  /               \  (NO)
                                   v                 v
                          [Commit Both Legs]   [Revert & Rollback All]
```

### Core Contracts (`src/`)

- [`src/TandemSpreadRouter.sol`](file:///mnt/data/Projects/tandem/src/TandemSpreadRouter.sol): The primary atomic router contract. Executes spot market orders on Kuru and opens/closes isolated shorts on Perpl. Evaluates net spreads and enforces transaction-wide rollback.
- [`src/TandemOrder.sol`](file:///mnt/data/Projects/tandem/src/TandemOrder.sol): EIP-712 typed data hashing and signature verification for `SpreadOrder` and `CloseOrder` with strict replay protection and on-chain nonce invalidation.
- [`src/adapters/KuruAdapter.sol`](file:///mnt/data/Projects/tandem/src/adapters/KuruAdapter.sol): Venue adapter for Kuru Central Limit Order Book (`clobMarketBuy` / `clobMarketSell`), handling native MON conversions, lot sizing, and fill-or-kill slippage protection.
- [`src/adapters/PerplAdapter.sol`](file:///mnt/data/Projects/tandem/src/adapters/PerplAdapter.sol): Venue adapter for Perpl Perpetual DEX, managing isolated margin accounts, deposit collateralization, short position entry (`openShort`), and paired exits (`closeShort`).
- [`src/libraries/SpreadMath.sol`](file:///mnt/data/Projects/tandem/src/libraries/SpreadMath.sol): High-precision integer math for effective spot pricing, basis calculation, and fee validation with conservative rounding.

---

## 3. Mathematical Spread Specification

The net adjusted entry spread is defined consistently in quote units (USDC/AUSD, 6 decimals) per 1.0 MON (18 decimals):

$$\text{Adjusted Entry Spread} = \text{Actual Perp Short Price} - \text{Effective Spot Buy Price} - \text{Total Fees per MON}$$

### Formula Definitions

$$\text{Effective Spot Buy Price} = \frac{\text{Actual Quote Spent} \times 10^{18}}{\text{Spot MON Received}}$$

$$\text{Total Fees per MON} = \frac{\text{Execution Fees} \times 10^{18}}{\text{Spot MON Received}}$$

### Reverse Flow (Atomic Paired Exit / Close Order)

When closing an active paired position, the basis yield is locked in on-chain by selling spot MON on Kuru and buying back the short on Perpl:

$$\text{Adjusted Exit Spread} = \text{Effective Spot Sale Price} - \text{Actual Perp Close Price} - \text{Exit Fees per MON}$$

Where:
- $\text{Effective Spot Sale Price} = \frac{\text{Quote Proceeds Received} \times 10^{18}}{\text{Spot MON Sold}}$
- All integer division uses conservative rounding to prevent over-estimating yields.
- Network gas is measured separately; collateral is treated as margin allocation rather than fee overhead.

---

## 4. Critical Security & Execution Rules

1. **10-Point Parameter Binding**: EIP-712 signatures strictly bind:
   - `owner` & `account`: Verifies trader ownership and isolation.
   - `chainId`: Eliminates cross-chain replay between Monad Mainnet (`143`) and Testnet (`10143`).
   - `kuruMarket` & `quoteToken`: Restricts execution to authorized venues.
   - `quantity` & `perpLots`: Prevents unmatched size delivery.
   - `maxSpotSpend` & `minPerpPrice`: Leg-specific execution bounds.
   - `collateral`: Margin allocation cap.
   - `minSpread` & `maxFee`: Economic profitability threshold.
   - `expiry`: Time-bound authorization.
   - `nonce`: Sequential cancellation and single-use guarantee.
2. **Actual Balance Delta Accounting**: The router verifies real token balance changes (`postBalance - preBalance`) rather than trusting external return values.
3. **Independent Trader Recovery**: In the event that any off-chain relayer is unreachable, traders retain direct contract authority to call [`closeSpreadOrder`](file:///mnt/data/Projects/tandem/src/TandemSpreadRouter.sol#L130) or [`cancelSpreadOrder`](file:///mnt/data/Projects/tandem/src/TandemSpreadRouter.sol#L162) directly from their EOA.
4. **Isolated Margin Awareness**: Perpl DEX utilizes isolated margin accounts per market. Tandem exposes clear risk indicators and supports manual margin top-up to prevent liquidation during extreme market divergence.

---

## 5. Live End-to-End Verification

### Pinned Monad Fork Foundry Tests

All contract features are verified against the official Monad Mainnet fork pinned at block **`109312895`** with live liquidity from Kuru and Perpl:

```bash
forge test --fork-url http://127.0.0.1:8545 --match-contract TandemSpreadRouterTest -vv
```

```
Ran 8 tests for test/TandemSpreadRouter.t.sol:TandemSpreadRouterTest
[PASS] test_ExecuteSpreadOrder_FullAtomicSuccess() (gas: 822845)
[PASS] test_CloseSpreadOrder_PairedExit() (gas: 1102931)
[PASS] test_SpreadRejection_RollsBackTransaction() (gas: 233442)
[PASS] test_CancelNonce_PreventsExecution() (gas: 94184)
[PASS] test_SignatureVerification_Valid() (gas: 25010)
[PASS] test_SignatureVerification_InvalidSignerReverts() (gas: 76517)
[PASS] test_ExpiredOrder_Reverts() (gas: 256021)
[PASS] test_ReplayAttack_Reverts() (gas: 812886)
Suite result: ok. 8 passed; 0 failed; 0 skipped
```

### Full Round-Trip E2E Flow (`pnpm test:e2e`)

The repository includes a live end-to-end integration test flow ([`services/executor/src/e2e-flow.ts`](file:///mnt/data/Projects/tandem/services/executor/src/e2e-flow.ts)) executing the entire round-trip lifecycle against real on-chain contracts:

```bash
pnpm test:e2e
```

```
================================================================
🚀 TANDEM SPREAD ORDERS: LIVE E2E INTEGRATION FLOW
================================================================
• Network RPC:       http://127.0.0.1:8545
• Tandem Router:     0xaD82Ecf79e232B0391C5479C7f632aA1EA701Ed1
• Trader Account:    0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

--- [Step 1] Querying Trader Pre-Trade Balances ---
  MON Balance:   1002.521 MON | USDC Balance: 1000 USDC | AUSD Balance: 1000 AUSD

--- [Step 2] Querying Live Kuru CLOB Spot Orderbook ---
  Kuru Best Bid (raw): 27348000000000000 ($0.2734)
  Kuru Best Ask (raw): 27402000000000000 ($0.2740)

--- [Step 3] Constructing Typed EIP-712 Spread Order ---
  Quantity Leg 1: 1.0 MON | Perp Lots Leg 2: 100 Lots (Short) | Min Net Spread: >= 0.000000

--- [Step 4] Signing EIP-712 Typed Data with Trader Key ---
  EIP-712 Signature: 0xb6ecda91977ad19a91a746f447a534...cf5d6f3927d4ba1c

--- [Step 5] Simulating Atomic Paired Execution (eth_call) ---
  Simulation Succeeded! Spot MON to Receive: 3.649 MON | Simulated Spread: 0.772598 AUSD/MON

--- [Step 6] Broadcasting Atomic Spread Transaction to Monad Network ---
  Tx Broadcast Hash: 0x308b8309796d4b26207bec5852323bc0aad9e9348a5942e1babef7fbb271f0c7
  Included in Block: 109312911 | Status: SUCCESS | Gas Used: 505311

--- [Step 7] Verifying Post-Trade Balances & Position ---
  Spot MON Acquired:   +3.6426 MON
  USDC Quote Spent:    -0.1000 USDC
  AUSD Margin Locked:  -500.00 AUSD
  On-chain Replay Protection: isOrderExecuted = true

--- [Step 8] Testing Rollback Protection with Unmet Spread Condition ---
  High-Spread Simulation Correctly Reverted: true (0xb29d1949)

--- [Step 9] Executing Reverse Flow: Paired Atomic Exit (Close Order) ---
  Close Order Hash: 0xbd74492aa770803e4e8a7f1ebe9202200970a4bed9e57221083215d241a07d3c
  Broadcasting closeSpreadOrder transaction...
  Close Transaction Hash: 0x354464a29b8e6176473e10ea87096d4ebba0091e0d5e88b49abbac2d6aabea10
  Exit Status: SUCCESS (Gas Used: 450512)
  Spot MON Sold:          1.000 MON
  USDC Proceeds Received: +0.027348 USDC
  On-chain Replay Protection for Close: isOrderExecuted = true

================================================================
🎉 FULL ROUND-TRIP LIFECYCLE (ENTRY -> HOLD -> ATOMIC EXIT) PASS!
================================================================
```

---

## 6. TypeScript SDK Usage (`@tandem/sdk`)

The `@tandem/sdk` package provides zero-overhead, type-safe functions for interacting with Tandem contracts:

```typescript
import {
  SpreadOrder,
  CloseOrder,
  signSpreadOrder,
  hashSpreadOrder,
  signCloseOrder,
  hashCloseOrder,
  CONTRACT_ADDRESSES,
  monadChain,
} from '@tandem/sdk';

// 1. Authorize Atomic Spread Entry
const spreadOrder: SpreadOrder = {
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
  minPerpPrice: 800_000n,
  collateral: 500_000_000n, // 500 AUSD
  minSpread: 500_000n, // +0.50 AUSD/MON
  maxFee: 5_000_000n,
};

const entrySignature = await signSpreadOrder(walletClient, account, spreadOrder, routerAddress, 143);
const entryHash = hashSpreadOrder(spreadOrder, routerAddress, 143);

// 2. Authorize Reverse Flow (Paired Atomic Exit)
const closeOrder: CloseOrder = {
  owner: traderAddress,
  account: traderAddress,
  nonce: 102n,
  expiry: BigInt(Math.floor(Date.now() / 1000) + 3600),
  kuruMarket: CONTRACT_ADDRESSES.KURU_MON_USDC,
  quoteToken: CONTRACT_ADDRESSES.USDC,
  perpId: 1n,
  quantity: 10n ** 18n,
  perpLots: 100n,
  minSpotProceeds: 25_000n, // Min 0.025 USDC proceeds
  maxPerpClosePrice: 900_000n,
  minExitSpread: -100_000_000_000n,
};

const exitSignature = await signCloseOrder(walletClient, account, closeOrder, routerAddress, 143);
const exitHash = hashCloseOrder(closeOrder, routerAddress, 143);
```

---

## 7. Containerization & Deployment

Tandem is packaged as production-grade Docker containers configured via **Docker Compose**:

- **`tandem-executor`**: Node.js 22 LTS container running Fastify API server, on-chain watcher, order simulator, and execution loop with Docker healthchecks.
- **`tandem-web`**: Production Nginx container serving the compiled React terminal with gzip compression, cache policies, SPA route fallbacks, and a reverse-proxy routing `/api/*` to the executor backend.

### Quick Start with Docker

```bash
# 1. Build production images (offline workspace bundle)
pnpm docker:build

# 2. Launch services in the background
pnpm docker:up

# 3. Stream container logs
pnpm docker:logs
```

### Endpoints & Healthchecks

| Service | Port | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **Web Trading Terminal** | `3000` | `http://localhost:3000` | Nginx SPA interface |
| **API Reverse Proxy** | `3000` | `http://localhost:3000/api/market` | Live market ticker feed |
| **Orders API** | `3000` | `http://localhost:3000/api/orders` | Active order queue |
| **Close Orders API** | `3000` | `http://localhost:3000/api/orders/close` | Reverse flow relayer |
| **Healthcheck** | `3000` | `http://localhost:3000/health` | Container healthcheck endpoint |

---

## 8. Monad Metropolis Deployment Records

| Component | Network | Contract Address | Notes / Explorer |
| :--- | :--- | :--- | :--- |
| **TandemSpreadRouter** | **Monad Testnet (10143)** | `0xC7885f87e2027F90D8cd4372CE5071b3aFE19E91` | **Live Deployed** • Block `66981631` • Tx: `0xaee18e5f...b425282` |
| **TandemSpreadRouter** | **Monad Fork (143)** | `0xaD82Ecf79e232B0391C5479C7f632aA1EA701Ed1` | Verified with live Kuru & Perpl state |
| **Deployer Wallet** | Monad Testnet (10143) | `0xB99DF9c70a4bA401CCc32DEBa43393905C80294C` | Verified Deployer & Fee Recipient |
| **Kuru MON-USDC Market** | Monad (143) | `0x065C9d28E428A0db40191a54d33d5b7c71a9C394` | Live CLOB OrderBook |
| **Perpl Exchange Proxy** | Monad (143) | `0x34B6552d57a35a1D042CcAe1951BD1C370112a6F` | Isolated Perpetual DEX Engine |
| **USDC** | Monad (143) | `0x754704Bc059F8C67012fEd69BC8A327a5aafb603` | Spot Quote Asset (6 decimals) |
| **AUSD** | Monad (143) | `0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a` | Perpetual Margin Asset (6 decimals) |

---

## 9. Demo Video Recording

A video demonstration capturing the full functionality of the Tandem protocol is stored in:

```
demo/tandem-demo.mp4
```

> **Note**: The `demo/` folder is untracked from Git (configured in [`.gitignore`](file:///mnt/data/Projects/tandem/.gitignore)).

The video demonstrates:
1. Live market metrics polling (Kuru spot ask, Perpl perp mark price, real-time net spread calculation).
2. Web3 wallet connection and network detection.
3. EIP-712 typed order authorization for paired entry.
4. Background executor monitoring and on-chain simulation.
5. Atomic transaction execution with balance settlement.
6. Unmet spread condition rejection enforcing 100% atomic rollback.
7. Reverse flow: Paired atomic exit (selling spot MON + closing perp short in 1 transaction).

---

## 10. License

This project is licensed under the [MIT License](file:///mnt/data/Projects/tandem/LICENSE).
