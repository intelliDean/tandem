# Tandem Mathematical Specification & Accounting Model

This document specifies the exact mathematical formulas, decimal standardizations, rounding conventions, and economic checks implemented in the Tandem smart contracts and SDK.

---

## 1. Units, Decimals & Denominations

To avoid floating point inaccuracies and precision loss across diverse token decimals, Tandem standardizes all mathematical operations to fixed integer arithmetic:

| Asset / Parameter | Decimals | Base Unit | Representation |
| :--- | :--- | :--- | :--- |
| **MON (Spot Asset)** | 18 | `10^18` wei | 1 MON = `1,000,000,000,000,000,000` |
| **USDC (Kuru Quote Token)** | 6 | `10^6` micro-units | 1 USDC = `1,000,000` |
| **AUSD (Perpl Margin Token)** | 6 | `10^6` micro-units | 1 AUSD = `1,000,000` |
| **Perpl Perpetual Lot Size** | Custom | 100 Lots = 1 MON | Defined by Perpl DEX market parameters |
| **Spread Value** | 6 | `10^6` (Quote per MON) | Expressed as signed integer ($0.50 spread = `500,000`) |

---

## 2. Entry Spread Formulation

The **Adjusted Entry Spread** measures the net yield of selling perpetual futures while purchasing spot assets, accounting for slippage, orderbook depth, and service fees:

$$\text{Adjusted Entry Spread} = \text{Actual Perp Short Price} - \text{Effective Spot Buy Price} - \text{Total Fees per MON}$$

### 2.1. Effective Spot Buy Price Calculation

Given:
- $Q_{\text{spent}}$: Actual USDC quote tokens deducted on Kuru (6 decimals)
- $S_{\text{received}}$: Actual MON tokens received from Kuru (18 decimals)

$$\text{Effective Spot Buy Price} = \frac{Q_{\text{spent}} \times 10^{18}}{S_{\text{received}}}$$

Result has 6 decimals of precision (representing USDC per 1 MON).

### 2.2. Total Fees per Matched MON

Given:
- $F_{\text{total}}$: Protocol and venue trading fees charged in quote units (6 decimals)

$$\text{Total Fees per MON} = \frac{F_{\text{total}} \times 10^{18}}{S_{\text{received}}}$$

### 2.3. On-Chain Condition Enforcement

The router enforces that the realized net spread strictly satisfies the trader's signed minimum bound:

$$\text{Adjusted Entry Spread} \ge \text{order.minSpread}$$

$$\text{Total Fees per MON} \le \text{order.maxFee}$$

If either inequality fails:
$$\textbf{Revert with SpreadBelowMinimum() or FeeExceedsMaximum()}$$

---

## 3. Reverse Flow (Paired Atomic Exit / Close Order)

When unwinding an active basis trade, the user sells spot MON on Kuru and buys back the perpetual short position on Perpl:

$$\text{Adjusted Exit Spread} = \text{Effective Spot Sale Price} - \text{Actual Perp Close Price} - \text{Exit Fees per MON}$$

### 3.1. Effective Spot Sale Price

Given:
- $Q_{\text{proceeds}}$: Net USDC proceeds received from selling MON on Kuru (6 decimals)
- $S_{\text{sold}}$: Actual MON sold (18 decimals)

$$\text{Effective Spot Sale Price} = \frac{Q_{\text{proceeds}} \times 10^{18}}{S_{\text{sold}}}$$

### 3.2. Exit Invariant Check

$$\text{Adjusted Exit Spread} \ge \text{closeOrder.minExitSpread}$$

$$\text{Actual Perp Close Price} \le \text{closeOrder.maxPerpClosePrice}$$

$$\text{Quote Proceeds Received} \ge \text{closeOrder.minSpotProceeds}$$

---

## 4. Rounding Rules & Precision Guardrails

1. **Conservative Rounding**:
   - In all calculations estimating net yield, division rounds **down** (in favor of security).
   - In all calculations estimating costs or fees, division rounds **up** (preventing under-estimation of expenses).
2. **Flash Accounting Deltas**:
   - Spot tokens acquired are computed via `IERC20.balanceOf(account)` delta: $\Delta_{\text{MON}} = \text{Balance}_{\text{after}} - \text{Balance}_{\text{before}}$.
   - No assumptions are made regarding theoretical fill sizes; only realized tokens in hand dictate execution validity.
3. **Collateral vs. Fee Separation**:
   - Margin deposited on Perpl is strictly collateral allocation and is never counted as an expense or fee.
   - Gas expenditures are reported independently and excluded from the basis spread check to maintain deterministic EIP-712 valuations.
