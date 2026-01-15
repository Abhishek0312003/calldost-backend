import { createClient } from 'redis';
import dotenv from 'dotenv';
dotenv.config();

const isTls = process.env.REDISURL?.startsWith('rediss://');

export const redis = createClient({
  url: process.env.REDISURL,
  socket: {
    keepAlive: 10000,
    reconnectStrategy: retries => Math.min(retries * 200, 5000),
    tls: isTls ? {} : undefined,
  },
});

redis.on('ready', () => console.log('Redis ready'));
redis.on('error', err => console.error('Redis error:', err));

export const connectRedis = async () => {
  if (!redis.isOpen) {
    await redis.connect();
    await redis.ping();
    console.log('Redis connected');
  }
};

process.on('SIGINT', async () => {
  await redis.quit();
  process.exit(0);
});
