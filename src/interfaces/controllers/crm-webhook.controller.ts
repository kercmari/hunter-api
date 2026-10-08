import { Controller, Get, Headers, HttpCode, Logger, Param, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ResolveConversationUseCase } from '../../application/use-cases/resolve-conversation.use-case';
import { validateHubSpotSignature } from '../../infrastructure/crm/hubspot-signature';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { PhonePipe } from '../pipes/phone.pipe';

const NEW_MESSAGE_SUBSCRIPTION = 'conversation.newMessage';

interface HubSpotEvent {
  subscriptionType?: string;
  objectId?: number | string;
  messageId?: string;
  portalId?: number;
}

@Controller('api/v1/crm')
export class CrmWebhookController {
  private readonly logger = new Logger(CrmWebhookController.name);

  constructor(private readonly resolver: ResolveConversationUseCase) {}

  @Post('webhooks/conversations')
  @HttpCode(200)
  receive(@Req() request: Request, @Headers() headers: Record<string, string>) {
    const clientSecret = (process.env.HUBSPOT_CLIENT_SECRET ?? '').trim();
    const rawBody = (request as Request & { rawBody?: Buffer }).rawBody?.toString('utf8') ?? '';

    const protocol = headers['x-forwarded-proto'] ?? request.protocol;
    const host = headers['x-forwarded-host'] ?? headers.host;

    const check = validateHubSpotSignature({
      method: request.method,
      uri: `${protocol}://${host}${request.originalUrl}`,
      rawBody,
      signature: headers['x-hubspot-signature-v3'],
      timestamp: headers['x-hubspot-request-timestamp'],
      clientSecret,
      nowMs: Date.now(),
    });

    if (!check.valid) {
      this.logger.warn(`Webhook rejected: ${check.reason}`);
      throw new UnauthorizedException('Invalid signature');
    }

    const events: HubSpotEvent[] = Array.isArray(request.body) ? request.body : [];
    const expectedPortal = (process.env.HUBSPOT_PORTAL_ID ?? '').trim();

    void this.process(events, expectedPortal);
    return { ok: true, received: events.length };
  }

  private async process(events: HubSpotEvent[], expectedPortal: string): Promise<void> {
    for (const event of events) {
      if (event.subscriptionType !== NEW_MESSAGE_SUBSCRIPTION) continue;

      if (expectedPortal && String(event.portalId ?? '') !== expectedPortal) {
        this.logger.warn(`Event from a different portal (${event.portalId}), ignored.`);
        continue;
      }

      try {
        await this.resolver.execute({
          threadId: String(event.objectId ?? ''),
          messageId: event.messageId ? String(event.messageId) : undefined,
        });
      } catch (error) {

        this.logger.error(`Event ${event.objectId} failed: ${(error as Error).message}`);
      }
    }
  }
}
