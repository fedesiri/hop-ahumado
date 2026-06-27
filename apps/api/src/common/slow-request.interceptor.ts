import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import type { Request } from "express";
import { Logger } from "nestjs-pino";
import { tap } from "rxjs/operators";

const SLOW_THRESHOLD_MS = 500;

@Injectable()
export class SlowRequestInterceptor implements NestInterceptor {
  constructor(private readonly logger: Logger) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest<Request & { id?: string }>();
    const start = Date.now();
    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        if (duration >= SLOW_THRESHOLD_MS) {
          this.logger.warn(
            { requestId: req.id, method: req.method, url: req.url, duration },
            `Slow request: ${duration}ms`,
          );
        }
      }),
    );
  }
}
