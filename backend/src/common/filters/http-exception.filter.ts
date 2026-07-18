import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { STATUS_CODES } from 'node:http';
import { BusinessException } from '../exceptions/business.exception';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsHandler');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const internalServerErrorStatus: number = HttpStatus.INTERNAL_SERVER_ERROR;
    const status: number =
      exception instanceof HttpException
        ? exception.getStatus()
        : internalServerErrorStatus;

    if (status >= internalServerErrorStatus) {
      // Preserve the real 5xx status (503/502/504 must survive for NFR-11
      // client back-off) but never leak the internal message or stack.
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(`${request.method} ${request.url} -> ${status}`, stack);
      response.status(status).json({
        statusCode: status,
        message: 'Internal server error',
        error: STATUS_CODES[status] ?? 'Internal Server Error',
      });
      return;
    }

    const exceptionResponse = (exception as HttpException).getResponse();
    const bodyFromException =
      typeof exceptionResponse === 'string'
        ? { message: exceptionResponse }
        : (exceptionResponse as Record<string, unknown>);

    // Default `error` from the status reason phrase so the envelope always
    // carries it (a BusinessException / string HttpException has no `error`
    // of its own); `statusCode` is set last so it stays authoritative.
    const body: Record<string, unknown> = {
      error: STATUS_CODES[status] ?? 'Error',
      ...bodyFromException,
      statusCode: status,
    };
    if (exception instanceof BusinessException) {
      body.errorCode = exception.errorCode;
    }

    response.status(status).json(body);
  }
}
