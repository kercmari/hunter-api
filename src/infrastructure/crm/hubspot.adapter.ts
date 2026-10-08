import { Injectable, Logger } from '@nestjs/common';
import { CrmPort, ThreadIdentity } from '../../application/ports/crm.port';

const BASE_URL = 'https://api.hubapi.com';
const THREADS_PATH = '/conversations/v3/conversations/threads';
const TIMEOUT_MS = 10_000;

@Injectable()
export class HubSpotAdapter implements CrmPort {
  private readonly logger = new Logger(HubSpotAdapter.name);

  private get token(): string {
    return (process.env.HUBSPOT_TOKEN ?? '').trim();
  }

  async resolveThread(threadId: string): Promise<ThreadIdentity | null> {
    if (!this.token) {
      this.logger.warn('HUBSPOT_TOKEN is not configured, identities will not be resolved.');
      return null;
    }

    try {
      const thread = await this.get(`${THREADS_PATH}/${encodeURIComponent(threadId)}`);
      const messages = await this.get(`${THREADS_PATH}/${encodeURIComponent(threadId)}/messages`);

      let phone = '';
      for (const message of messages?.results ?? []) {
        if (message?.type !== 'MESSAGE') continue;
        for (const sender of message?.senders ?? []) {
          const identifier = sender?.deliveryIdentifier;
          if (identifier?.type === 'HS_PHONE_NUMBER' && identifier?.value && !phone) {
            phone = String(identifier.value);
          }
        }
      }

      const identity: ThreadIdentity = {
        threadId: String(threadId),
        contactId: thread?.associatedContactId ? String(thread.associatedContactId) : undefined,
        phone: phone || undefined,
      };

      if (!identity.phone) {

        this.logger.debug(`Thread ${threadId} has no phone number (non-telephony channel).`);
      }
      return identity;
    } catch (error) {
      this.logger.error(`Could not resolve thread ${threadId}: ${(error as Error).message}`);
      return null;
    }
  }

  private async get(path: string): Promise<any> {
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${this.token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 200);
      throw new Error(`HubSpot responded ${response.status}: ${detail}`);
    }
    return response.json();
  }
}
