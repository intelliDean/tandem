import Fastify from 'fastify';
import cors from '@fastify/cors';
import { orderStore } from './orderStore.js';
import { fetchLiveMarketState } from './watcher.js';
import { startExecutionEngine } from './executionEngine.js';
import { SpreadOrder } from '@tandem/sdk';
import { Hash } from 'viem';

const fastify = Fastify({ logger: true });

await fastify.register(cors, {
  origin: true,
  methods: ['GET', 'POST'],
});

fastify.get('/health', async () => {
  return { status: 'ok', timestamp: Date.now() };
});

fastify.get('/api/market', async () => {
  const market = await fetchLiveMarketState();
  return {
    spotBestBid: market.spotBestBid.toString(),
    spotBestAsk: market.spotBestAsk.toString(),
    perpMarkPrice: market.perpMarkPrice.toString(),
    currentSpread: market.currentSpread.toString(),
    timestamp: market.timestamp,
  };
});

fastify.get('/api/orders', async () => {
  const orders = orderStore.getAllOrders();
  return orders.map((o) => ({
    ...o,
    order: {
      ...o.order,
      nonce: o.order.nonce.toString(),
      expiry: o.order.expiry.toString(),
      quantity: o.order.quantity.toString(),
      perpLots: o.order.perpLots.toString(),
      maxSpotSpend: o.order.maxSpotSpend.toString(),
      minPerpPrice: o.order.minPerpPrice.toString(),
      collateral: o.order.collateral.toString(),
      minSpread: o.order.minSpread.toString(),
      maxFee: o.order.maxFee.toString(),
    },
    lastSimulatedSpread: o.lastSimulatedSpread?.toString(),
    executionResult: o.executionResult
      ? {
          ...o.executionResult,
          spotMonReceived: o.executionResult.spotMonReceived.toString(),
          spotQuoteSpent: o.executionResult.spotQuoteSpent.toString(),
          perpOrderId: o.executionResult.perpOrderId.toString(),
          actualSpread: o.executionResult.actualSpread.toString(),
          actualFee: o.executionResult.actualFee.toString(),
        }
      : undefined,
  }));
});

fastify.post('/api/orders', async (request, reply) => {
  const body = request.body as {
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
  };

  if (!body.orderHash || !body.order || !body.signature) {
    return reply.status(400).send({ error: 'Missing order parameters' });
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

const PORT = Number(process.env.PORT || 3001);

const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`[Executor Server] listening on http://0.0.0.0:${PORT}`);
    startExecutionEngine(3000);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
