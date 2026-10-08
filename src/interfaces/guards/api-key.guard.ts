import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const expected = (process.env.CONVAI_API_KEY || process.env.API_KEY || '').trim();

    if (!expected) {
      this.logger.error('API_KEY is not configured, rejecting every request.');
      throw new UnauthorizedException('Service credential is not configured');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const header = String(request.headers.authorization ?? '');
    const received = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

    if (!this.matches(received, expected)) {
      this.logger.warn(`Invalid credential from ${request.ip ?? 'unknown origin'}`);
      throw new UnauthorizedException('Invalid credential');
    }
    return true;
  }

  private matches(received: string, expected: string): boolean {
    const receivedBuffer = Buffer.from(received);
    const expectedBuffer = Buffer.from(expected);
    if (receivedBuffer.length !== expectedBuffer.length) {

      timingSafeEqual(expectedBuffer, expectedBuffer);
      return false;
    }
    return timingSafeEqual(receivedBuffer, expectedBuffer);
  }
}
