export interface OrderItem {
  id: string;
  orderHash: string;
  quantity: string;
  minSpread: string;
  status: 'PENDING' | 'SIMULATING' | 'EXECUTING' | 'EXECUTED' | 'FAILED' | 'CANCELLED';
  simulatedSpread?: string;
  timestamp: string;
  txHash?: string;
}

export interface MarketState {
  spotAsk: number;
  perpBid: number;
  netSpread: string;
}

export interface PositionState {
  hasPosition: boolean;
  spotMonHeld: string;
  positionLots: string;
  lockedMargin: string;
  entryPerpPrice: string;
  entrySpotPrice: string;
  unrealizedPnl: string;
}
