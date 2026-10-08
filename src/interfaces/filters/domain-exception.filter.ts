import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ConflictError, DomainError, NotFoundError } from '../../domain/errors/domain.error';

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<{ method?: string; url?: string }>();
    const route = `${request?.method ?? '?'} ${request?.url ?? '?'}`;

    if (exception instanceof NotFoundError) {
      this.logger.warn(`404 on ${route}: ${exception.message}`);
      response.status(HttpStatus.NOT_FOUND).json({ error: exception.code, message: exception.message });
      return;
    }

    if (exception instanceof ConflictError) {
      this.logger.warn(`409 on ${route}: ${exception.message}`);
      response.status(HttpStatus.CONFLICT).json({ error: exception.code, message: exception.message });
      return;
    }

    if (exception instanceof DomainError) {
      this.logger.warn(`400 on ${route}: ${exception.message}`);
      response.status(HttpStatus.BAD_REQUEST).json({ error: exception.code, message: exception.message });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status >= 500) this.logger.error(`${status} on ${route}: ${exception.message}`);
      response.status(status).json(exception.getResponse());
      return;
    }

    const error = exception as Error;
    this.logger.error(`500 on ${route}: ${error?.message}`, error?.stack);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
  }
}
