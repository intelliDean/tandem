import { Address } from 'viem';
import { CONTRACT_ADDRESSES } from '@tandem/sdk';
import { fetchLiveMarketState } from './watcher.js';
import { orderStore } from './orderStore.js';
import { simulateSpreadOrder } from './simulator.js';
import { dispatchSpreadOrder, executorAccount } from './dispatcher.js';
import { PendingSpreadOrderRecord } from './types.js';

const ROUTER_ADDRESS = (process.env.TANDEM_ROUTER_ADDRESS || CONTRACT_ADDRESSES.TANDEM_SPREAD_ROUTER) as Address;

let isRunning = false;

/**
 * Evaluates and processes a single pending spread order
 */
async function processOrder(record: PendingSpreadOrderRecord): Promise<void> {
  orderStore.updateStatus(record.orderHash, 'SIMULATING');

  // 1. Simulate on-chain execution with exact user parameters
  const simulation = await simulateSpreadOrder(
    ROUTER_ADDRESS,
    record.order,
    record.signature,
    executorAccount.address
  );

  if (!simulation.success || !simulation.result) {
    console.log(`[Engine] Simulation failed for ${record.orderHash}: ${simulation.error}`);
    orderStore.updateStatus(record.orderHash, 'PENDING', { lastError: simulation.error });
    return;
  }

  const { result } = simulation;
  console.log(`[Engine] Simulated order ${record.orderHash} successfully! Actual spread: ${result.actualSpread}`);

  // 2. Check if simulated spread satisfies user's limit
  if (result.actualSpread < record.order.minSpread) {
    console.log(`[Engine] Spread unmet for ${record.orderHash}: required ${record.order.minSpread}, actual ${result.actualSpread}`);
    orderStore.updateStatus(record.orderHash, 'PENDING', { lastSimulatedSpread: result.actualSpread });
    return;
  }

  // 3. Dispatch transaction to Monad network
  console.log(`[Engine] Spread condition satisfied! Submitting transaction for ${record.orderHash}...`);
  orderStore.updateStatus(record.orderHash, 'EXECUTING', { lastSimulatedSpread: result.actualSpread });

  try {
    const { txHash, receipt } = await dispatchSpreadOrder(ROUTER_ADDRESS, record.order, record.signature);

    if (receipt.status === 'success') {
      console.log(`[Engine] Confirmed in block ${receipt.blockNumber}! TxHash: ${txHash}`);
      orderStore.updateStatus(record.orderHash, 'EXECUTED', {
        executionTxHash: txHash,
        executionResult: result,
      });
    } else {
      console.error(`[Engine] Transaction reverted onchain: ${txHash}`);
      orderStore.updateStatus(record.orderHash, 'FAILED', {
        executionTxHash: txHash,
        lastError: 'Transaction reverted onchain',
      });
    }
  } catch (dispatchErr: any) {
    console.error(`[Engine] Dispatch error for ${record.orderHash}:`, dispatchErr);
    orderStore.updateStatus(record.orderHash, 'PENDING', {
      lastError: dispatchErr?.shortMessage || dispatchErr?.message || 'Dispatch error',
    });
  }
}

/**
 * Performs a single pass over all pending orders
 */
export async function processPendingOrdersOnce(): Promise<void> {
  const pending = orderStore.getPendingOrders();
  if (pending.length === 0) return;

  const market = await fetchLiveMarketState();
  console.log(`[Engine] Polling ${pending.length} pending orders. Current Spread: ${market.currentSpread}`);

  for (const record of pending) {
    await processOrder(record);
  }
}

/**
 * Starts the continuous background execution polling loop
 */
export function startExecutionEngine(intervalMs: number = 3000): void {
  if (isRunning) return;
  isRunning = true;
  console.log(`[Engine] Execution engine started (interval: ${intervalMs}ms)`);

  const loop = async () => {
    if (!isRunning) return;
    try {
      await processPendingOrdersOnce();
    } catch (e) {
      console.error('[Engine] Loop error:', e);
    }
    setTimeout(loop, intervalMs);
  };

  loop();
}

/**
 * Stops the background execution engine
 */
export function stopExecutionEngine(): void {
  isRunning = false;
  console.log('[Engine] Execution engine stopped');
}
