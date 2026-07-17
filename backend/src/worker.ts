import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as amqplib from 'amqplib';
import { AppModule } from './app.module';

async function bootstrap() {
  if (process.env.WORKER !== 'true') {
    throw new Error('worker.ts must be started with WORKER=true');
  }

  const logger = new Logger('Worker');
  await NestFactory.createApplicationContext(AppModule);

  const connection = await amqplib.connect(
    process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672',
  );
  // Without these, amqplib emits 'error' on an EventEmitter with no listener
  // and the process dies by uncaught exception rather than restarting.
  connection.on('error', (err: Error) =>
    logger.error(`RabbitMQ connection error: ${err.message}`),
  );
  connection.on('close', () => {
    logger.error('RabbitMQ connection closed — exiting to trigger a restart');
    process.exit(1);
  });
  logger.log('RabbitMQ connected');
}

bootstrap().catch((err) => {
  new Logger('Worker').error(err);
  process.exit(1);
});
