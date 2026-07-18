import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface ListPayload {
  items: unknown[];
  meta: Record<string, unknown>;
}

// Deliberate list-payload contract for later paginated endpoints (Stories
// 2.9, 4.3, 5.3, etc.) — no controller returns this shape yet in this story.
function isListPayload(value: unknown): value is ListPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as ListPayload).items) &&
    typeof (value as ListPayload).meta === 'object' &&
    (value as ListPayload).meta !== null
  );
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<unknown> {
    return next.handle().pipe(
      map((value) => {
        // Streamed/file downloads (EXAM-08 crops, source_file_url) and empty
        // void/204 responses must pass through untouched — wrapping them in
        // { data } corrupts the download or turns "no content" into {}.
        if (value instanceof StreamableFile || value === undefined) {
          return value;
        }
        if (isListPayload(value)) {
          return { data: value.items, meta: value.meta };
        }
        return { data: value };
      }),
    );
  }
}
