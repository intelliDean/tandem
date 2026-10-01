# Tandem Deployment & Verification Guide

This guide covers local environment setup, Monad network fork testing, contract deployment, Docker containerization, and verification procedures for the Tandem protocol.

---

## 1. Prerequisites

- **Node.js**: v20 or v22 LTS
- **pnpm**: v9+
- **Foundry**: `forge`, `cast`, and `anvil`
- **Docker & Docker Compose**: v24+
- **Monad RPC Access**: e.g., `https://rpc.monad.xyz` or local archive node

---

## 2. Local Pinned Fork Setup

To test against live state with authentic Kuru orderbooks and Perpl perpetual liquidity:

```bash
# Start an Anvil fork at pinned block 109312895
anvil --fork-url https://rpc.monad.xyz \
      --fork-block-number 109312895 \
      --chain-id 143 \
      --port 8545
```

---

## 3. Running Test Suites

### 3.1. Foundry Unit & Fork Tests

```bash
forge test --fork-url http://127.0.0.1:8545 --match-contract TandemSpreadRouterTest -vv
```

**Expected Results**:
- `test_ExecuteSpreadOrder_FullAtomicSuccess`: Verifies paired spot purchase + perp short opening.
- `test_CloseSpreadOrder_PairedExit`: Verifies reverse flow spot sale + perp short unwinding.
- `test_SpreadRejection_RollsBackTransaction`: Verifies EVM rollback when spread is below minimum.
- `test_CancelNonce_PreventsExecution`: Verifies on-chain nonce invalidation.
- `test_ReplayAttack_Reverts`: Verifies single-use signature protection.
- `test_ExpiredOrder_Reverts`: Verifies time-bound expiry check.

### 3.2. Full Round-Trip E2E Flow

```bash
pnpm test:e2e
```

Executes all 9 steps:
1. Balance pre-flight inspection
2. Live Kuru CLOB orderbook query
3. EIP-712 SpreadOrder construction
4. Cryptographic signing with trader private key
5. Pre-execution `eth_call` simulation
6. On-chain transaction broadcast & receipt verification
7. Delta balance audit
8. High-spread rollback verification
9. Reverse flow paired atomic exit (`closeSpreadOrder`)

---

## 4. Docker Production Deployment

### 4.1. Build & Run Containers

```bash
# Build production images
pnpm docker:build

# Launch services in the background
pnpm docker:up

# Check container status
docker ps --filter "name=tandem"
```

### 4.2. Verify Health & APIs

```bash
# 1. Healthcheck
curl -i http://localhost:3000/health

# 2. Market feed
curl -s http://localhost:3000/api/market | jq

# 3. Order queue
curl -s http://localhost:3000/api/orders | jq
```

---

## 5. Deployed Contract Registry

| Network | Contract | Address | Verification / Explorer |
| :--- | :--- | :--- | :--- |
| **Monad Testnet (10143)** | `TandemSpreadRouter` | `0xC7885f87e2027F90D8cd4372CE5071b3aFE19E91` | Block `66981631` |
| **Monad Fork (143)** | `TandemSpreadRouter` | `0xaD82Ecf79e232B0391C5479C7f632aA1EA701Ed1` | Local Fork verified |
| **Monad Mainnet (143)** | Kuru MON-USDC Market | `0x065C9d28E428A0db40191a54d33d5b7c71a9C394` | Live CLOB Market |
| **Monad Mainnet (143)** | Perpl Exchange Proxy | `0x34B6552d57a35a1D042CcAe1951BD1C370112a6F` | Isolated Perpetual DEX |
| **Monad Mainnet (143)** | USDC Token | `0x754704Bc059F8C67012fEd69BC8A327a5aafb603` | 6 Decimals |
| **Monad Mainnet (143)** | AUSD Token | `0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a` | 6 Decimals |
