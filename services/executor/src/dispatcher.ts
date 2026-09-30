import { createWalletClient, http, Address, Hash, TransactionReceipt } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { TANDEM_SPREAD_ROUTER_ABI, SpreadOrder, monadChain, monadTestnetChain } from '@tandem/sdk';
import { publicClient } from './watcher.js';

const EXECUTOR_KEY = process.env.EXECUTOR_PRIVATE_KEY as `0x${string}` | undefined;

export const executorAccount = EXECUTOR_KEY
  ? privateKeyToAccount(EXECUTOR_KEY)
  : privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');

const targetChain = process.env.CHAIN_ID === '10143' ? monadTestnetChain : monadChain;

export const walletClient = createWalletClient({
  account: executorAccount,
  chain: targetChain,
  transport: http(process.env.MONAD_RPC_URL || 'https://rpc.monad.xyz'),
});

export interface DispatchOutcome {
  txHash: Hash;
  receipt: TransactionReceipt;
}

/**
 * Submits an atomic spread order execution transaction to the Monad network
 */
export async function dispatchSpreadOrder(
  routerAddress: Address,
  order: SpreadOrder,
  signature: `0x${string}`,
  customWallet?: any,
  customPubClient?: any
): Promise<DispatchOutcome> {
  const wallet = customWallet || walletClient;
  const pubClient = customPubClient || publicClient;
  const txHash = await wallet.writeContract({
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
  });

  const receipt = await pubClient.waitForTransactionReceipt({ hash: txHash });
  return { txHash, receipt };
}
