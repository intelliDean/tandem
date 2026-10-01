import { FastifyPluginAsync } from 'fastify';
import { Hash, createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { SpreadOrder, CloseOrder, TANDEM_SPREAD_ROUTER_ABI, monadChain } from '@tandem/sdk';
import { orderStore } from './orderStore.js';
import { fetchLiveMarketState } from './watcher.js';

interface SubmitOrderBody {
  orderHash: Hash;
  order: {
    owner: `0x${string}`;
    account: `0x${string}`;
    nonce: string;
    expiry: string;
    kuruMarket: `0x${string}`;
    quoteToken: `0x${string}`;
    perpId: string;
    quantity: string;
    perpLots: string;
    maxSpotSpend: string;
    minPerpPrice: string;
    collateral: string;
    minSpread: string;
    maxFee: string;
  };
  signature: `0x${string}`;
}

interface SubmitCloseOrderBody {
  orderHash: Hash;
  closeOrder: {
    owner: `0x${string}`;
    account: `0x${string}`;
    nonce: string;
    expiry: string;
    kuruMarket: `0x${string}`;
    quoteToken: `0x${string}`;
    perpId: string;
    quantity: string;
    perpLots: string;
    minSpotProceeds: string;
    maxPerpClosePrice: string;
    minExitSpread: string;
  };
  signature: `0x${string}`;
}

function serializeBigInt(obj: any): any {
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt);
  }
  if (obj !== null && typeof obj === 'object') {
    const res: any = {};
    for (const [k, v] of Object.entries(obj)) {
      res[k] = serializeBigInt(v);
    }
    return res;
  }
  return obj;
}

export const apiRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: Date.now() };
  });

  fastify.get('/api/market', async () => {
    const market = await fetchLiveMarketState();
    return serializeBigInt({
      spotBestBid: market.spotBestBid,
      spotBestAsk: market.spotBestAsk,
      perpMarkPrice: market.perpMarkPrice,
      currentSpread: market.currentSpread,
      timestamp: market.timestamp,
    });
  });

  fastify.get('/api/orders', async () => {
    const orders = orderStore.getAllOrders();
    return serializeBigInt(orders);
  });

  fastify.post('/api/orders', async (request, reply) => {
    const body = request.body as SubmitOrderBody;

    if (!body?.orderHash || !body?.order || !body?.signature) {
      return reply.status(400).send({ error: 'Missing required order parameters' });
    }

    const parsedOrder: SpreadOrder = {
      owner: body.order.owner,
      account: body.order.account,
      nonce: BigInt(body.order.nonce),
      expiry: BigInt(body.order.expiry),
      kuruMarket: body.order.kuruMarket,
      quoteToken: body.order.quoteToken,
      perpId: BigInt(body.order.perpId),
      quantity: BigInt(body.order.quantity),
      perpLots: BigInt(body.order.perpLots),
      maxSpotSpend: BigInt(body.order.maxSpotSpend),
      minPerpPrice: BigInt(body.order.minPerpPrice),
      collateral: BigInt(body.order.collateral),
      minSpread: BigInt(body.order.minSpread),
      maxFee: BigInt(body.order.maxFee),
    };

    orderStore.addOrder({
      orderHash: body.orderHash,
      order: parsedOrder,
      signature: body.signature,
      createdAt: Date.now(),
      status: 'PENDING',
    });

    return { success: true, orderHash: body.orderHash };
  });

  fastify.post('/api/orders/close', async (request, reply) => {
    const body = request.body as SubmitCloseOrderBody;

    if (!body?.orderHash || !body?.closeOrder || !body?.signature) {
      return reply.status(400).send({ error: 'Missing required close order parameters' });
    }

    try {
      const RPC_URL = process.env.MONAD_RPC_URL || 'http://127.0.0.1:8545';
      const ROUTER_ADDRESS = (process.env.TANDEM_ROUTER_ADDRESS || '0xaD82Ecf79e232B0391C5479C7f632aA1EA701Ed1') as `0x${string}`;
      const EXECUTOR_KEY = (process.env.EXECUTOR_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80') as `0x${string}`;

      const client = createPublicClient({ chain: monadChain, transport: http(RPC_URL) });
      const wallet = createWalletClient({ account: privateKeyToAccount(EXECUTOR_KEY), chain: monadChain, transport: http(RPC_URL) });

      const parsedCloseOrder: CloseOrder = {
        owner: body.closeOrder.owner,
        account: body.closeOrder.account,
        nonce: BigInt(body.closeOrder.nonce),
        expiry: BigInt(body.closeOrder.expiry),
        kuruMarket: body.closeOrder.kuruMarket,
        quoteToken: body.closeOrder.quoteToken,
        perpId: BigInt(body.closeOrder.perpId),
        quantity: BigInt(body.closeOrder.quantity),
        perpLots: BigInt(body.closeOrder.perpLots),
        minSpotProceeds: BigInt(body.closeOrder.minSpotProceeds),
        maxPerpClosePrice: BigInt(body.closeOrder.maxPerpClosePrice),
        minExitSpread: BigInt(body.closeOrder.minExitSpread),
      };

      const nativeValue = parsedCloseOrder.quantity + 10_000_000_000_000_000n; // quantity + buffer
      const txHash = await wallet.writeContract({
        address: ROUTER_ADDRESS,
        abi: TANDEM_SPREAD_ROUTER_ABI,
        functionName: 'closeSpreadOrder',
        args: [parsedCloseOrder, body.signature],
        value: nativeValue,
      });

      const receipt = await client.waitForTransactionReceipt({ hash: txHash });

      return {
        success: receipt.status === 'success',
        txHash,
        orderHash: body.orderHash,
        status: receipt.status === 'success' ? 'CLOSED' : 'FAILED',
        blockNumber: receipt.blockNumber.toString(),
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (err: any) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Close order execution failed',
        message: err?.shortMessage || err?.message || 'Transaction failed',
      });
    }
  });
};
