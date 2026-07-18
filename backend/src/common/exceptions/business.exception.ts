import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from './error-codes';

// The only legal way a business error carries an errorCode (AD-16) — nothing
// else in the codebase should hand-build an error-envelope object.
export class BusinessException extends HttpException {
  constructor(
    public readonly errorCode: ErrorCode,
    status: HttpStatus,
    message: string,
  ) {
    super({ message, errorCode }, status);
  }
}
