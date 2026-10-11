import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? (exception.getResponse() as { message?: string | string[] }).message ?? exception.message
        : "Internal server error";

    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url} → ${status}`, exception instanceof Error ? exception.stack : String(exception));
    }

    // Machine-readable details the UI relies on (402 UPGRADE_REQUIRED / LIMIT_REACHED / SUBSCRIPTION_INACTIVE). Allowlisted.
    const body = exception instanceof HttpException ? (exception.getResponse() as Record<string, unknown>) : {};
    const detail: Record<string, unknown> = {};
    for (const k of ["code", "feature", "metric", "limit", "used"]) if (typeof body === "object" && body && k in body) detail[k] = body[k];

    response.status(status).json({
      statusCode: status,
      message,
      ...detail,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
