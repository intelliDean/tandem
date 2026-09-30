import { Address, Hash } from 'viem';

export interface SpreadOrder {
  owner: Address;
  account: Address;
  nonce: bigint;
  expiry: bigint;
  kuruMarket: Address;
  quoteToken: Address;
  perpId: bigint;
  quantity: bigint; // MON (18 decimals)
  perpLots: bigint; // Lots on Perpl
  maxSpotSpend: bigint; // Quote tokens (6 decimals)
  minPerpPrice: bigint; // Scaled perp price
  collateral: bigint; // Collateral for Perpl (6 decimals)
  minSpread: bigint; // Net entry spread threshold (1e6 scaling)
  maxFee: bigint; // Max execution fee (1e6)
}

export interface CloseOrder {
  owner: Address;
  account: Address;
  nonce: bigint;
  expiry: bigint;
  kuruMarket: Address;
  quoteToken: Address;
  perpId: bigint;
  quantity: bigint; // MON to sell
  perpLots: bigint; // Lots to close
  minSpotProceeds: bigint; // Min quote tokens received
  maxPerpClosePrice: bigint; // Max buy-back price
  minExitSpread: bigint; // Exit spread threshold
}

export interface ExecutionResult {
  orderHash: Hash;
  spotMonReceived: bigint;
  spotQuoteSpent: bigint;
  perpOrderId: bigint;
  actualSpread: bigint;
  actualFee: bigint;
}

export interface PairedPosition {
  perpId: bigint;
  lotLNS: bigint;
  entryPricePNS: bigint;
  depositCNS: bigint;
  pnlCNS: bigint;
  spotMonBalance: bigint;
  isPaired: boolean;
}
