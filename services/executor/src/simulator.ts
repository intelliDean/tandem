import { Address } from 'viem';
import { TANDEM_SPREAD_ROUTER_ABI, SpreadOrder, ExecutionResult } from '@tandem/sdk';
import { publicClient } from './watcher.js';

export interface SimulationOutcome {
  success: boolean;
  result?: ExecutionResult;
  error?: string;
}

/**
 * Simulates on-chain atomic spread execution via eth_call
 */
export async function simulateSpreadOrder(
  routerAddress: Address,
  order: SpreadOrder,
  signature: `0x${string}`,
  callerAddress: Address
): Promise<SimulationOutcome> {
  try {
    const { result } = await publicClient.simulateContract({
      address: routerAddress,
      abi: TANDEM_SPREAD_ROUTER_ABI,
      functionName: 'executeSpreadOrder',
      args: [
        {
          owner: order.owner,
          account: order.account,
          nonce: order.nonce,
          expiry: order.expiry,
          kuruMarket: order.kuruMarket,
          quoteToken: order.quoteToken,
          perpId: order.perpId,
          quantity: order.quantity,
          perpLots: order.perpLots,
          maxSpotSpend: order.maxSpotSpend,
          minPerpPrice: order.minPerpPrice,
          collateral: order.collateral,
          minSpread: order.minSpread,
          maxFee: order.maxFee,
        },
        signature,
      ],
      account: callerAddress,
    });

    return {
      success: true,
      result: {
        orderHash: result.orderHash,
        spotMonReceived: result.spotMonReceived,
        spotQuoteSpent: result.spotQuoteSpent,
        perpOrderId: result.perpOrderId,
        actualSpread: result.actualSpread,
        actualFee: result.actualFee,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.shortMessage || err?.message || 'Simulation reverted',
    };
  }
}
