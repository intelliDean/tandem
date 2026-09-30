import Fastify from 'fastify';
import cors from '@fastify/cors';
import { apiRoutes } from './routes.js';
import { startExecutionEngine } from './executionEngine.js';

const fastify = Fastify({ logger: true });

await fastify.register(cors, {
  origin: true,
  methods: ['GET', 'POST'],
});

await fastify.register(apiRoutes);

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
