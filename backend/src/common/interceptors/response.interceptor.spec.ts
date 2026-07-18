import { CallHandler, ExecutionContext, StreamableFile } from '@nestjs/common';
import { of } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';

describe('ResponseInterceptor', () => {
  let interceptor: ResponseInterceptor<unknown>;

  beforeEach(() => {
    interceptor = new ResponseInterceptor();
  });

  function run(value: unknown) {
    const callHandler: CallHandler = { handle: () => of(value) };
    const context = {} as ExecutionContext;
    return new Promise((resolve) => {
      interceptor
        .intercept(context, callHandler)
        .subscribe((result) => resolve(result));
    });
  }

  it('wraps a plain object as { data: value }', async () => {
    const result = await run({ status: 'ok' });
    expect(result).toEqual({ data: { status: 'ok' } });
  });

  it('wraps an array as { data: [...] }', async () => {
    const result = await run([1, 2, 3]);
    expect(result).toEqual({ data: [1, 2, 3] });
  });

  it('unwraps a { items, meta } list payload into { data: items, meta }', async () => {
    const items = [{ id: 1 }, { id: 2 }];
    const meta = { page: 1, limit: 10, total: 2 };
    const result = await run({ items, meta });
    expect(result).toEqual({ data: items, meta });
  });

  it('passes a StreamableFile through untouched (no data wrap)', async () => {
    const file = new StreamableFile(Buffer.from('pdf-bytes'));
    const result = await run(file);
    expect(result).toBe(file);
  });

  it('passes an undefined (void/204) response through untouched', async () => {
    const result = await run(undefined);
    expect(result).toBeUndefined();
  });
});
