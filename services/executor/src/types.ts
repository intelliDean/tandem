import { SpreadOrder, ExecutionResult } from '@tandem/sdk';
import { Hash } from 'viem';

export type OrderStatus = 'PENDING' | 'SIMULATING' | 'EXECUTING' | 'EXECUTED' | 'FAILED' | 'EXPIRED' | 'CANCELLED';

export interface PendingSpreadOrderRecord {
  orderHash: Hash;
  order: SpreadOrder;
  signature: `0x${string}`;
  createdAt: number;
  status: OrderStatus;
  lastSimulatedSpread?: bigint;
  executionTxHash?: Hash;
  executionResult?: ExecutionResult;
  lastError?: string;
}

export interface MarketState {
  spotBestBid: bigint;
  spotBestAsk: bigint;
  perpMarkPrice: bigint;
  currentSpread: bigint;
  timestamp: number;
}
