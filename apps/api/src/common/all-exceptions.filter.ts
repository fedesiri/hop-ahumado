import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from "@nestjs/common";
import type { Request, Response } from "express";
import { Logger } from "nestjs-pino";
import type { FirebaseRequest } from "../auth/firebase-auth.guard";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { id?: string } & FirebaseRequest>();
    const res = ctx.getResponse<Response>();

    const status = exception instanceof HttpException ? exception.getStatus() : 500;

    if (status >= 500) {
      this.logger.error(
        {
          requestId: req.id,
          method: req.method,
          url: req.url,
          userEmail: req.firebaseUser?.email ?? null,
          err:
            exception instanceof Error
              ? { message: exception.message, stack: exception.stack }
              : String(exception),
        },
        "Unhandled exception",
      );
    }

    const body =
      exception instanceof HttpException
        ? exception.getResponse()
        : { statusCode: 500, message: "Internal server error" };

    res.status(status).json(body);
  }
}
