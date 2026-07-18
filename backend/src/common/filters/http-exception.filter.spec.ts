import {
  ArgumentsHost,
  HttpStatus,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BusinessException } from '../exceptions/business.exception';
import { ErrorCode } from '../exceptions/error-codes';
import { HttpExceptionFilter } from './http-exception.filter';

function createHost() {
  let capturedBody: Record<string, unknown> | undefined;
  const json = jest.fn((body: Record<string, unknown>) => {
    capturedBody = body;
  });
  const status = jest.fn().mockReturnValue({ json });
  const response = { status, json };
  const request = { method: 'GET', url: '/api/test' };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;

  return { host, status, json, getBody: () => capturedBody };
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let loggedArgs: unknown[][];

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    // Silence + observe the required AC-3 server-side log.
    loggedArgs = [];
    jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation((...args: unknown[]) => {
        loggedArgs.push(args);
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps a built-in HttpException to the generic envelope without errorCode, and does not log 4xx as an incident', () => {
    const { host, status, json, getBody } = createHost();

    filter.catch(new NotFoundException('x'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      statusCode: 404,
      message: 'x',
      error: 'Not Found',
    });
    expect(getBody()).not.toHaveProperty('errorCode');
    expect(loggedArgs).toHaveLength(0);
  });

  it('includes errorCode and the reason-phrase error field for a BusinessException', () => {
    const { host, status, json } = createHost();

    filter.catch(
      new BusinessException('SOME_CODE' as ErrorCode, HttpStatus.CONFLICT, 'y'),
      host,
    );

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        message: 'y',
        error: 'Conflict',
        errorCode: 'SOME_CODE',
      }),
    );
  });

  it('never leaks the raw message of an uncaught 5xx error and logs it server-side', () => {
    const { host, status, json, getBody } = createHost();

    filter.catch(new Error('leaked secret'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
      error: 'Internal Server Error',
    });
    expect(JSON.stringify(getBody())).not.toContain('leaked secret');
    expect(loggedArgs).toContainEqual([
      'GET /api/test -> 500',
      expect.any(String),
    ]);
  });

  it('preserves the real 5xx status (503) while scrubbing the internal message', () => {
    const { host, status, json, getBody } = createHost();

    filter.catch(new ServiceUnavailableException('gemini down'), host);

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith({
      statusCode: 503,
      message: 'Internal server error',
      error: 'Service Unavailable',
    });
    expect(JSON.stringify(getBody())).not.toContain('gemini down');
  });
});
