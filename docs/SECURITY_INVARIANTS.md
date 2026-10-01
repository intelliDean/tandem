# Tandem Security Model & Invariants

This document outlines the security architecture, invariant catalog, failure modes, and mitigation strategies implemented in the Tandem smart contracts and infrastructure.

---

## 1. Core Protocol Invariants

The protocol guarantees the following formal invariants at all times:

| Invariant ID | Name | Mathematical / Logical Expression | Enforcement |
| :--- | :--- | :--- | :--- |
| **INV-01** | **All-or-Nothing Atomicity** | $(\text{SpotBought} > 0 \land \text{PerpOpened} > 0) \lor (\text{SpotBought} = 0 \land \text{PerpOpened} = 0)$ | Single-tx EVM atomic rollback |
| **INV-02** | **Net Spread Monotonicity** | $\text{RealizedSpread} \ge \text{order.minSpread}$ | Reverts with `SpreadBelowMinimum()` |
| **INV-03** | **Fee Ceiling Bound** | $\text{RealizedFeesPerMon} \le \text{order.maxFee}$ | Reverts with `FeeExceedsMaximum()` |
| **INV-04** | **Replay Protection** | $\forall \text{ orderHash}, \text{executedCount} \le 1$ | On-chain mapping `isOrderExecuted[hash]` |
| **INV-05** | **Zero Idle Custody** | $\text{Balance}_{\text{Router}}(\text{MON}) = 0 \land \text{Balance}_{\text{Router}}(\text{USDC}) = 0$ | Ephemeral flash execution |
| **INV-06** | **Chain Binding** | $\text{order.domain.chainId} = \text{block.chainid}$ | EIP-712 domain separator validation |
| **INV-07** | **Single Paired Position** | $\text{activePositions}(\text{account}) \le 1$ | Subaccount isolation per trader |

---

## 2. EIP-712 10-Point Parameter Binding

Every `SpreadOrder` signature mathematically locks 10 critical parameters:

1. `owner`: The EOA owning the assets and signing the intent.
2. `account`: The Perpl subaccount address authorized for trading.
3. `nonce`: Incremental or random nonce enabling selective invalidation.
4. `expiry`: Unix timestamp after which the order is permanently invalid.
5. `kuruMarket`: Pre-approved Kuru CLOB market address (prevents routing through malicious pools).
6. `quoteToken`: Pre-approved quote token address (e.g. USDC).
7. `perpId`: Perpl market identifier (e.g. MON-PERP).
8. `quantity`: Exact spot quantity to acquire.
9. `perpLots`: Matching perpetual contract lots to short.
10. `minSpread`: Realized spread floor required for execution.

---

## 3. Failure Mode & Mitigation Analysis

### 3.1. Asynchronous Legging-In (Prevented)
- **Threat**: Spot order executes on Kuru, but Perpl rejects margin or perp order fails due to index price divergence.
- **Mitigation**: Both calls occur within the scope of `TandemSpreadRouter.executeSpreadOrder`. If the Perpl call returns false or reverts, the entire transaction reverts, undoing the spot purchase on Kuru.

### 3.2. Sandwich & Adverse Execution (Prevented)
- **Threat**: MEV searchers sandwich the spot purchase, giving the trader unfavorable spot execution.
- **Mitigation**:
  1. The Kuru adapter specifies maximum quote spend (`maxSpotSpend`) for fill-or-kill protection.
  2. The net spread check evaluates the actual quote spent versus the perp short price received. If an MEV sandwich reduces the net spread below `minSpread`, the transaction reverts.

### 3.3. Relayer Unavailability & Trader Sovereign Recovery
- **Threat**: The centralized executor service goes offline, crashes, or censors orders.
- **Mitigation**:
  - The trader never surrenders custody of funds to the executor.
  - Traders can execute orders directly from their wallet using the "Execute Now" method on the router.
  - Traders can cancel pending nonces on-chain anytime by invoking `cancelSpreadOrder(nonce)`.
  - Traders can close active positions independently by invoking `closeSpreadOrder` directly.

### 3.4. Isolated Margin Liquidation Risk
- **Context**: Perpl uses isolated margin accounts per market. While the spot MON holding acts as a hedge against the short, sharp price spikes can trigger liquidation on Perpl before the trader closes the position.
- **Mitigation**:
  - Web UI displays live margin health, liquidation price estimates, and position leverage.
  - Traders can deposit additional margin collateral directly into Perpl without modifying the router contract.
