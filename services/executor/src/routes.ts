import { FastifyPluginAsync } from 'fastify';
import { Hash } from 'viem';
import { SpreadOrder } from '@tandem/sdk';
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
};
