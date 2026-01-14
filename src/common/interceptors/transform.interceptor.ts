import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface ResponseData {
  [key: string]: unknown;
}

@Injectable()
export class TransformInterceptor
  implements NestInterceptor<ResponseData, ResponseData>
{
  private recursivelyTransform(obj: unknown, seen = new WeakSet()): unknown {
    if (!obj) return obj;

    if (typeof obj !== 'object') return obj;

    if (obj instanceof Date) return obj;

    if (seen.has(obj)) return obj;
    seen.add(obj);

    if (Array.isArray(obj)) {
      return obj.map((item) => this.recursivelyTransform(item, seen));
    }

    const processedObj = obj as Record<string, unknown>;

    const transformed: ResponseData = {};
    for (const [key, value] of Object.entries(processedObj)) {
      if (typeof value !== 'function' && typeof value !== 'symbol') {
        transformed[key] = this.recursivelyTransform(value, seen);
      }
    }

    return transformed;
  }

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ResponseData> {
    return next.handle().pipe(
      map((data: ResponseData): ResponseData => {
        try {
          return this.recursivelyTransform(data) as ResponseData;
        } catch (error) {
          console.error('Transform interceptor error:', error);
          return data;
        }
      }),
    );
  }
}
