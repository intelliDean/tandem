import { createPublicClient, http, Address } from 'viem';
import { KURU_ORDERBOOK_ABI, CONTRACT_ADDRESSES, MONAD_CHAIN_ID } from '@tandem/sdk';
import { MarketState } from './types.js';

const RPC_URL = process.env.MONAD_RPC_URL || 'https://rpc.monad.xyz';

export const publicClient = createPublicClient({
  transport: http(RPC_URL),
});

export async function fetchLiveMarketState(kuruMarket: Address = CONTRACT_ADDRESSES.KURU_MON_USDC): Promise<MarketState> {
  try {
    const [bestBid, bestAsk] = await publicClient.readContract({
      address: kuruMarket,
      abi: KURU_ORDERBOOK_ABI,
      functionName: 'bestBidAsk',
    });

    // In Kuru MON-USDC:
    // bestAsk is the lowest quote price sellers are willing to accept
    // bestBid is the highest quote price buyers are willing to pay
    // Spread calculation: Perp Price - Spot Ask Price
    // Default simulated perp mark price for MON: ~839083 (scaled) or based on reference
    const perpMarkPrice = 839083n; // ~0.839083 USDC/MON equivalent scale
    const currentSpread = perpMarkPrice - (bestAsk > 0n ? bestAsk / 10000000000n : 0n);

    return {
      spotBestBid: bestBid,
      spotBestAsk: bestAsk,
      perpMarkPrice,
      currentSpread,
      timestamp: Date.now(),
    };
  } catch (err) {
    console.error('Failed to fetch live market state:', err);
    return {
      spotBestBid: 0n,
      spotBestAsk: 0n,
      perpMarkPrice: 839083n,
      currentSpread: 0n,
      timestamp: Date.now(),
    };
  }
}
