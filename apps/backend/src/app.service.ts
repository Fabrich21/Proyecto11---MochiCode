import { Injectable } from '@nestjs/common';
import { createClient } from 'redis';

@Injectable()
export class AppService {
  async getHealth() {
    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
    const redisClient = createClient({ url: redisUrl });

    let redis = 'down';

    try {
      await redisClient.connect();
      await redisClient.ping();
      redis = 'up';
    } catch {
      redis = 'down';
    } finally {
      if (redisClient.isOpen) {
        await redisClient.quit();
      }
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        api: 'up',
        redis,
      },
    };
  }
}
