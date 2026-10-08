import { ConversationIdentityPort } from '../../application/ports/tool-integrations.port';
import { Injectable, Logger } from '@nestjs/common';
import { CONVERSATIONS } from './conversations.constants';

export interface ConversationIdentity {
  threadId: string;

  contactId: string;

  phoneE164: string;
  texts: string[];
  lastSeenAtMs: number;
}

export function digitsOnly(s: string): string {
  return (s || '').replace(/\D+/g, '');
}

function stripHtml(s: string): string {
  return (s || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;?/gi, ' ')
    .replace(/&amp;/gi, '&');
}

@Injectable()
export class ConversationDirectory implements ConversationIdentityPort {
  private readonly log = new Logger('ConversationDirectory');

  private readonly byThread = new Map<string, ConversationIdentity>();

  private readonly processedMessages = new Map<string, number>();

  private get token(): string {
    return (process.env.HUBSPOT_TOKEN || '').trim();
  }

  alreadyProcessed(messageId: string): boolean {
    if (!messageId) return false;
    this.gc();
    if (this.processedMessages.has(messageId)) return true;
    this.processedMessages.set(messageId, Date.now());
    return false;
  }

  async resolveThread(threadId: string): Promise<ConversationIdentity | null> {
    try {
      const thread = await this.call(`${CONVERSATIONS.THREADS_PATH}/${threadId}`);
      const messages = await this.listAll(`${CONVERSATIONS.THREADS_PATH}/${encodeURIComponent(threadId)}/messages?limit=100`);

      const texts: string[] = [];
      let phoneE164 = '';
      for (const m of messages) {

        if (m?.type !== 'MESSAGE') continue;
        if (typeof m?.text === 'string' && m.text.trim()) texts.push(stripHtml(m.text));
        for (const s of m?.senders ?? []) {
          const di = s?.deliveryIdentifier;
          if (di?.type === 'HS_PHONE_NUMBER' && di?.value && !phoneE164) phoneE164 = String(di.value);
        }
      }

      const identity: ConversationIdentity = {
        threadId: String(threadId),
        contactId: String(thread?.associatedContactId ?? ''),
        phoneE164,
        texts,
        lastSeenAtMs: Date.parse(thread?.latestMessageTimestamp ?? '') || Date.now(),
      };
      this.byThread.set(identity.threadId, identity);
      this.log.log(
        `threadId=${identity.threadId} contactId=${identity.contactId || '(sin asociar)'} phone=${phoneE164 || '(sin phone)'} msgs=${texts.length}`,
      );
      return identity;
    } catch (err) {
      this.log.error(`no se pudo resolver el hilo ${threadId}: ${(err as Error).message.slice(0, 200)}`);
      return null;
    }
  }

  async activeThreadIdentity(): Promise<ConversationIdentity | null> {
    for (let attempt = 0; attempt <= CONVERSATIONS.MATCH_RETRY_ATTEMPTS; attempt++) {
      let hit = this.latestWithPhone();
      if (hit) return hit;

      await this.refreshKnownThreads();
      hit = this.latestWithPhone();
      if (hit) return hit;

      await this.loadRecentThreads();
      hit = this.latestWithPhone();
      if (hit) return hit;

      if (attempt < CONVERSATIONS.MATCH_RETRY_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, CONVERSATIONS.MATCH_RETRY_DELAY_MS));
      }
    }
    this.log.warn('activeThreadIdentity(): ningún hilo activo con teléfono en la ventana');
    return null;
  }

  private latestWithPhone(): ConversationIdentity | null {
    this.gc();
    const minSeen = Date.now() - CONVERSATIONS.MATCH_LOOKBACK_MINUTES * 60_000;
    let best: ConversationIdentity | null = null;
    for (const id of this.byThread.values()) {
      if (id.lastSeenAtMs < minSeen || !id.phoneE164) continue;
      if (!best || id.lastSeenAtMs > best.lastSeenAtMs) best = id;
    }
    return best;
  }

  async findContactByText(identificacion: string, correo?: string): Promise<ConversationIdentity | null> {
    const target = digitsOnly(identificacion);
    if (!target) return null;

    for (let attempt = 0; attempt <= CONVERSATIONS.MATCH_RETRY_ATTEMPTS; attempt++) {

      let hit = this.pick(this.lookup(target), correo, target);
      if (hit) return hit;

      await this.refreshKnownThreads();
      hit = this.pick(this.lookup(target), correo, target);
      if (hit) return hit;

      await this.loadRecentThreads();
      hit = this.pick(this.lookup(target), correo, target);
      if (hit) return hit;

      if (attempt < CONVERSATIONS.MATCH_RETRY_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, CONVERSATIONS.MATCH_RETRY_DELAY_MS));
      }
    }
    this.log.warn(`sin hilo que contenga la cédula "${identificacion}" tras ${CONVERSATIONS.MATCH_RETRY_ATTEMPTS + 1} intentos`);
    return null;
  }

  private pick(cands: ConversationIdentity[], correo: string | undefined, target: string): ConversationIdentity | null {
    if (!cands.length) return null;

    const byContact = new Map<string, ConversationIdentity>();
    for (const c of cands) {
      const prev = byContact.get(c.contactId || c.phoneE164 || c.threadId);
      if (!prev || c.lastSeenAtMs > prev.lastSeenAtMs) byContact.set(c.contactId || c.phoneE164 || c.threadId, c);
    }
    if (byContact.size === 1) return [...byContact.values()][0] ?? null;

    if (correo) {
      const needle = correo.trim().toLowerCase();
      const withEmail = [...byContact.values()].filter((c) =>
        c.texts.some((t) => t.toLowerCase().includes(needle)),
      );
      if (withEmail.length === 1) return withEmail[0] ?? null;
    }

    this.log.error(
      `AMBIGÜEDAD para "${target}": ${byContact.size} contactos distintos [${[...byContact.keys()].join(', ')}] — no se escribe nada`,
    );
    return null;
  }

  private lookup(targetDigits: string): ConversationIdentity[] {
    this.gc();
    const minSeen = Date.now() - CONVERSATIONS.MATCH_LOOKBACK_MINUTES * 60_000;
    const out: ConversationIdentity[] = [];
    for (const id of this.byThread.values()) {
      if (id.lastSeenAtMs < minSeen) continue;
      if (id.texts.some((t) => digitsOnly(t).includes(targetDigits))) out.push(id);
    }
    return out;
  }

  private async refreshKnownThreads(): Promise<void> {
    const ids = [...this.byThread.keys()];
    for (const id of ids) {
      await this.resolveThread(id).catch(() => undefined);
    }
  }

  private async loadRecentThreads(): Promise<void> {
    try {

      const threads = await this.listAll(`${CONVERSATIONS.THREADS_PATH}?limit=${CONVERSATIONS.THREADS_LIST_LIMIT}`);
      const minTs = Date.now() - CONVERSATIONS.MATCH_LOOKBACK_MINUTES * 60_000;
      for (const t of threads) {
        const id = String(t?.id ?? '');
        if (!id || this.byThread.has(id)) continue;
        const ts = Date.parse(t?.latestMessageTimestamp ?? '');
        if (Number.isFinite(ts) && ts < minTs) continue; 
        await this.resolveThread(id).catch(() => undefined);
      }
    } catch (err) {
      this.log.warn(`no se pudieron listar hilos recientes: ${(err as Error).message.slice(0, 160)}`);
    }
  }

  private gc(): void {
    const now = Date.now();
    const ttl = CONVERSATIONS.DIRECTORY_TTL_MINUTES * 60_000;
    for (const [k, v] of this.byThread) if (now - v.lastSeenAtMs > ttl) this.byThread.delete(k);
    const mttl = CONVERSATIONS.PROCESSED_MESSAGES_TTL_MINUTES * 60_000;
    for (const [k, at] of this.processedMessages) if (now - at > mttl) this.processedMessages.delete(k);
  }

  private async listAll(path: string): Promise<any[]> {
    const results: any[] = [];
    const seen = new Set<string>();
    let after = '';
    for (let page = 0; page < 100; page++) {
      const cursor = after ? `&after=${encodeURIComponent(decodeURIComponent(after))}` : '';
      const response = await this.call(path + cursor);
      const items = response?.results ?? [];
      if (!items.length) return results;
      results.push(...items);
      const next = response?.paging?.next?.after;
      if (!next) return results;
      if (seen.has(String(next))) throw new Error('HubSpot repitió un cursor de paginación');
      after = String(next);
      seen.add(after);
    }
    throw new Error('La búsqueda de conversaciones superó el límite de páginas');
  }

  private async call(path: string): Promise<any> {
    const res = await fetch(`https://api.hubapi.com${path}`, {
      headers: { Authorization: `Bearer ${this.token}` },
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : null;
  }
}
