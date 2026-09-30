import { createWalletClient, http, Address, Hash } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { TANDEM_SPREAD_ROUTER_ABI, monadChain } from '@tandem/sdk';
import { publicClient, fetchLiveMarketState } from './watcher.js';
import { orderStore } from './orderStore.js';

const ROUTER_ADDRESS = (process.env.TANDEM_ROUTER_ADDRESS || '0xC7885f87e2027F90D8cd4372CE5071b3aFE19E91') as Address;
const EXECUTOR_KEY = process.env.EXECUTOR_PRIVATE_KEY as `0x${string}` | undefined;

const executorAccount = EXECUTOR_KEY
  ? privateKeyToAccount(EXECUTOR_KEY)
  : privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');

const walletClient = createWalletClient({
  account: executorAccount,
  chain: monadChain,
  transport: http(process.env.MONAD_RPC_URL || 'https://rpc.monad.xyz'),
});

let isRunning = false;

export async function processPendingOrdersOnce(): Promise<void> {
  const pending = orderStore.getPendingOrders();
  if (pending.length === 0) return;

  const market = await fetchLiveMarketState();
  console.log(`[Engine] Polling ${pending.length} pending orders. Current Spread: ${market.currentSpread.toString()}`);

  for (const record of pending) {
    try {
      orderStore.updateStatus(record.orderHash, 'SIMULATING');

      // 1. Simulate on-chain execution with the exact user parameters
      const { result } = await publicClient.simulateContract({
        address: ROUTER_ADDRESS,
        abi: TANDEM_SPREAD_ROUTER_ABI,
        functionName: 'executeSpreadOrder',
        args: [
          {
            owner: record.order.owner,
            account: record.order.account,
            nonce: record.order.nonce,
            expiry: record.order.expiry,
            kuruMarket: record.order.kuruMarket,
            quoteToken: record.order.quoteToken,
            perpId: record.order.perpId,
            quantity: record.order.quantity,
            perpLots: record.order.perpLots,
            maxSpotSpend: record.order.maxSpotSpend,
            minPerpPrice: record.order.minPerpPrice,
            collateral: record.order.collateral,
            minSpread: record.order.minSpread,
            maxFee: record.order.maxFee,
          },
          record.signature,
        ],
        account: executorAccount.address,
      });

      console.log(`[Engine] Simulated order ${record.orderHash} successfully! Actual spread: ${result.actualSpread}`);

      // Check if actual simulated spread satisfies user's threshold
      if (result.actualSpread >= record.order.minSpread) {
        console.log(`[Engine] Spread satisfied! Submitting transaction for ${record.orderHash}...`);
        orderStore.updateStatus(record.orderHash, 'EXECUTING', {
          lastSimulatedSpread: result.actualSpread,
        });

        // 2. Submit on-chain execution
        const txHash = await walletClient.writeContract({
          address: ROUTER_ADDRESS,
          abi: TANDEM_SPREAD_ROUTER_ABI,
          functionName: 'executeSpreadOrder',
          args: [
            {
              owner: record.order.owner,
              account: record.order.account,
              nonce: record.order.nonce,
              expiry: record.order.expiry,
              kuruMarket: record.order.kuruMarket,
              quoteToken: record.order.quoteToken,
              perpId: record.order.perpId,
              quantity: record.order.quantity,
              perpLots: record.order.perpLots,
              maxSpotSpend: record.order.maxSpotSpend,
              minPerpPrice: record.order.minPerpPrice,
              collateral: record.order.collateral,
              minSpread: record.order.minSpread,
              maxFee: record.order.maxFee,
            },
            record.signature,
          ],
        });

        console.log(`[Engine] Transaction submitted! TxHash: ${txHash}`);
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

        if (receipt.status === 'success') {
          console.log(`[Engine] Transaction confirmed in block ${receipt.blockNumber}`);
          orderStore.updateStatus(record.orderHash, 'EXECUTED', {
            executionTxHash: txHash,
            executionResult: {
              orderHash: result.orderHash,
              spotMonReceived: result.spotMonReceived,
              spotQuoteSpent: result.spotQuoteSpent,
              perpOrderId: result.perpOrderId,
              actualSpread: result.actualSpread,
              actualFee: result.actualFee,
            },
          });
        } else {
          console.error(`[Engine] Transaction reverted: ${txHash}`);
          orderStore.updateStatus(record.orderHash, 'FAILED', {
            executionTxHash: txHash,
            lastError: 'Transaction reverted onchain',
          });
        }
      } else {
        console.log(`[Engine] Spread condition unmet for ${record.orderHash}: required ${record.order.minSpread}, simulated ${result.actualSpread}`);
        orderStore.updateStatus(record.orderHash, 'PENDING', {
          lastSimulatedSpread: result.actualSpread,
        });
      }
    } catch (err: any) {
      console.log(`[Engine] Simulation failed or reverted for ${record.orderHash}: ${err?.shortMessage || err?.message || err}`);
      orderStore.updateStatus(record.orderHash, 'PENDING', {
        lastError: err?.shortMessage || err?.message,
      });
    }
  }
}

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

export function stopExecutionEngine(): void {
  isRunning = false;
  console.log('[Engine] Execution engine stopped');
}
