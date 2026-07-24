import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqplib from 'amqplib';
import type {
  ChannelModel,
  ConfirmChannel,
  RecoveringChannelModel,
} from 'amqplib';
import {
  AI_PARSE_QUEUE,
  type ParseJobMessage,
} from '../../common/messaging/parse-queue';

// Bound the confirm wait so a broker that accepts the channel but never sends a
// publisher-confirm ack (stalled channel / partial partition) cannot hang the
// exam-creation HTTP request forever — a timeout rejects, exam.service catches
// it, and the upload still returns 201 (the documented dual-write gap).
const PUBLISH_CONFIRM_TIMEOUT_MS = 10000;

/**
 * Publishes parse jobs onto the durable `ai.parse` queue (AD-13 publish side,
 * AD-18 worker split). No consumer exists yet — Story 2.2 adds it.
 */
@Injectable()
export class ParseJobPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ParseJobPublisher.name);
  private connection?: RecoveringChannelModel;
  private channel?: ConfirmChannel;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url =
      this.config.get<string>('RABBITMQ_URL') ??
      'amqp://guest:guest@localhost:5672';
    // Kick off the connection but do NOT block app boot on broker reachability:
    // ExamModule sits in the shared AppModule graph that every entrypoint loads
    // (main.ts AND worker.ts), so awaiting a down broker here would stall auth,
    // submission, dashboard and class startup too — not just exam upload. With
    // amqplib 2.x recovery (maxRetries defaults to Infinity) the connect promise
    // never rejects on a down broker; it retries in the background. Until the
    // first connect lands, publish() throws and exam.service treats it as the
    // documented dual-write gap (exam stays `pending`, recoverable via 2.3).
    void amqplib
      .connect(url, {
        recovery: {
          // setup() runs after EVERY successful (re)connect, so the confirm
          // channel and queue assertion are rebuilt on reconnect instead of
          // left pointing at the dead connection. Without it, this.channel
          // would go stale after the first broker blip and every publish()
          // would fail silently until a process restart.
          setup: async (model: ChannelModel) => {
            const channel = await model.createConfirmChannel();
            channel.on('error', (err: Error) =>
              this.logger.error(`RabbitMQ channel error: ${err.message}`),
            );
            await channel.assertQueue(AI_PARSE_QUEUE, { durable: true });
            this.channel = channel;
          },
        },
      })
      .then((connection) => {
        this.connection = connection;
        // Without an 'error' listener amqplib emits on a bare EventEmitter and
        // kills the process (see worker.ts) — attach before anything can fire.
        connection.on('error', (err: Error) =>
          this.logger.error(`RabbitMQ connection error: ${err.message}`),
        );
        connection.on('disconnect', (err: Error) => {
          // Drop the now-dead channel so publish() fails fast (the dual-write
          // gap) until setup() rebuilds it on the next successful reconnect.
          this.channel = undefined;
          this.logger.error(
            `RabbitMQ connection lost, recovering: ${err.message}`,
          );
        });
        this.logger.log('RabbitMQ connected; ai.parse queue asserted');
      })
      .catch((err: unknown) => {
        this.logger.error(
          `RabbitMQ initial connection failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });
  }

  async onModuleDestroy(): Promise<void> {
    // Close each handle independently: a channel that already errored/closed
    // would otherwise reject and skip closing the connection, leaking the socket.
    try {
      await this.channel?.close();
    } catch (err) {
      this.logger.error(
        `Error closing RabbitMQ channel: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    try {
      await this.connection?.close();
    } catch (err) {
      this.logger.error(
        `Error closing RabbitMQ connection: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /**
   * Resolves only once the broker has confirmed receipt — sendToQueue() alone
   * returns before the broker has the message, so a dropped publish would
   * strand the exam at `pending` forever with no signal. Rejects (rather than
   * hangs) if the channel is unavailable or the confirm ack never arrives.
   */
  async publish(job: ParseJobMessage): Promise<void> {
    const channel = this.channel;
    if (!channel) {
      throw new Error('ParseJobPublisher channel not initialized');
    }
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (err?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (err) reject(err);
        else resolve();
      };
      const timer = setTimeout(
        () => finish(new Error('RabbitMQ publish confirm timed out')),
        PUBLISH_CONFIRM_TIMEOUT_MS,
      );

      try {
        channel.sendToQueue(
          AI_PARSE_QUEUE,
          Buffer.from(JSON.stringify(job)),
          { persistent: true },
          (err: unknown) => {
            // A separate binding so control-flow narrowing on `err` (the falsy
            // check below) never taints the type used for String() — TS widens
            // unknown to `{}` once a null/undefined check narrows it, and `{}`
            // (unlike unknown) trips no-base-to-string.
            const cause: unknown = err;
            if (!err) {
              finish();
              return;
            }
            finish(cause instanceof Error ? cause : new Error(String(cause)));
          },
        );
      } catch (err) {
        // sendToQueue can throw synchronously if the channel closed between the
        // guard above and here — surface it as a rejection, not an uncaught throw.
        finish(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }
}
