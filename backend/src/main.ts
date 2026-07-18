import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import Redis from 'ioredis';
import { AppModule } from './app.module';
import { configureApp } from './common/configure-app';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.setGlobalPrefix('api');

  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  redis.on('connect', () => logger.log('Redis connected'));
  redis.on('error', (err) =>
    logger.error(`Redis connection error: ${err.message}`),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`HTTP server listening on port ${port}`);
}

bootstrap().catch((err) => {
  new Logger('Bootstrap').error(err);
  process.exit(1);
});
