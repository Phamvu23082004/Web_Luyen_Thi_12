import type { ConfirmChannel } from 'amqplib';
import { ParseJobPublisher } from './parse-job.publisher';
import {
  AI_PARSE_QUEUE,
  type ParseJobMessage,
} from '../../common/messaging/parse-queue';

const JOB: ParseJobMessage = {
  examId: 'exam-1',
  sourceFileRef: 'exams/exam-1/source.pdf',
  parseGeneration: 1,
};

function buildPublisher(): ParseJobPublisher {
  // ConfigService is unused once the channel is injected directly.
  return new ParseJobPublisher({} as never);
}

// Inject a fake confirm channel in place of a live broker connection.
function withChannel(
  publisher: ParseJobPublisher,
  channel: Pick<ConfirmChannel, 'sendToQueue'>,
): void {
  (publisher as unknown as { channel: unknown }).channel = channel;
}

describe('ParseJobPublisher.publish', () => {
  it('rejects when the channel is not initialized (broker never connected)', async () => {
    const publisher = buildPublisher();
    await expect(publisher.publish(JOB)).rejects.toThrow(
      'ParseJobPublisher channel not initialized',
    );
  });

  it('resolves once the broker confirms the publish', async () => {
    const publisher = buildPublisher();
    const sendToQueue = jest.fn(
      (
        _queue: string,
        _content: Buffer,
        _opts: unknown,
        cb: (err: unknown) => void,
      ) => {
        cb(undefined); // broker ack
        return true;
      },
    );
    withChannel(publisher, { sendToQueue });

    await expect(publisher.publish(JOB)).resolves.toBeUndefined();
    expect(sendToQueue).toHaveBeenCalledWith(
      AI_PARSE_QUEUE,
      Buffer.from(JSON.stringify(JOB)),
      { persistent: true },
      expect.any(Function),
    );
  });

  it('rejects when the broker nacks the publish', async () => {
    const publisher = buildPublisher();
    const sendToQueue = jest.fn(
      (
        _queue: string,
        _content: Buffer,
        _opts: unknown,
        cb: (err: unknown) => void,
      ) => {
        cb(new Error('nacked'));
        return true;
      },
    );
    withChannel(publisher, { sendToQueue });

    await expect(publisher.publish(JOB)).rejects.toThrow('nacked');
  });

  it('rejects (does not hang) when the confirm ack never arrives', async () => {
    jest.useFakeTimers();
    const publisher = buildPublisher();
    // Never invokes the confirm callback — simulates a stalled channel.
    const sendToQueue = jest.fn(() => true);
    withChannel(publisher, { sendToQueue });

    const pending = publisher.publish(JOB);
    const assertion = expect(pending).rejects.toThrow(
      'RabbitMQ publish confirm timed out',
    );
    await jest.advanceTimersByTimeAsync(10000);
    await assertion;
    jest.useRealTimers();
  });
});
