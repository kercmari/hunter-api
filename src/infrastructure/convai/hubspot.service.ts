import { ContractContactPort, InvoiceDeliveryPort, PaymentNotificationPort } from '../../application/ports/tool-integrations.port';
import { Injectable, Logger } from '@nestjs/common';
import { normalizePhone } from './phone.util';
import { HUBSPOT } from './hubspot.constants';

export interface ContactSeed {
  firstName?: string;
  lastName?: string;
}

export interface PaymentUpdate {
  status: string;
  amount: number;

  date: string;

  contratoId: string;
}

export interface ResolvedContact {
  id: string;
  phoneE164: string;
  existed: boolean;
}

export interface PagoNotificacion {
  correo: string;
  nombre_completo: string;
  telefono: string;
  contrato_id: string;
  monto: number;

  fecha: string;
  estado: 'confirmado' | 'rechazado';

  facturaUrl?: string;
}

interface HsContact {
  id: string;
  properties?: Record<string, string | null>;
}

@Injectable()
export class HubSpotService implements ContractContactPort, InvoiceDeliveryPort, PaymentNotificationPort {
  private readonly log = new Logger('HubSpotService');

  private readonly contactIdByPhone = new Map<string, string>();

  private readonly inFlight = new Map<string, Promise<void>>();

  private get token(): string {
    return (process.env.HUBSPOT_TOKEN || '').trim();
  }

  private get statusProperty(): string {
    return (process.env.HUBSPOT_PAGO_PROPERTY || HUBSPOT.PROP_PAYMENT_STATUS).trim();
  }

  async notificarPago(n: PagoNotificacion): Promise<void> {
    if (!this.token) {
      this.log.warn('HUBSPOT_TOKEN no configurado; se omite la notificación a HubSpot');
      return;
    }
    try {

      const phoneE164 = normalizePhone(n.telefono);
      let contactId = await this.findContactByContratoId(n.contrato_id);

      if (!contactId && phoneE164) {

        this.log.warn(`contrato ${n.contrato_id} no encontrado por contrato_id; respaldo por teléfono ${phoneE164}`);
        contactId = this.contactIdByPhone.get(phoneE164) ?? '';
      }
      if (!contactId) {
        this.log.error(
          `PAGO SIN CONTACTO: ${n.contrato_id} cobrado pero no se halló contacto (contrato_id ni teléfono) — el aviso NO va a salir. REVISIÓN MANUAL.`,
        );
        return;
      }
      const contact = { id: contactId, existed: true };

      if (n.facturaUrl) {
        await this.setInvoiceUrl(contact.id, n.facturaUrl, n.contrato_id);
      }

      await this.setPaymentStatus(
        contact.id,
        { status: n.estado, amount: n.monto, date: n.fecha, contratoId: n.contrato_id },
        phoneE164,
      );
      this.log.log(
        `HubSpot: contacto ${contact.id} (${phoneE164}${contact.existed ? '' : ', CREADO'}) -> ${this.statusProperty}=${n.estado}, ${HUBSPOT.PROP_PAYMENT_AMOUNT}=${n.monto.toFixed(2)}, ${HUBSPOT.PROP_PAYMENT_DATE}=${n.fecha}, ${HUBSPOT.PROP_CONTRACT_ID}=${n.contrato_id}`,
      );
    } catch (err) {
      this.log.error(`HubSpot: fallo notificando pago de ${n.contrato_id}: ${(err as Error).message}`);
    }
  }

  async ensureWhatsAppOptIn(contactId: string, phoneE164 = ''): Promise<boolean> {
    if (!this.token || !contactId) return false;
    try {
      const r = await this.call('PATCH', `${HUBSPOT.CONTACTS}/${contactId}`, {
        properties: { [HUBSPOT.PROP_OPTIN_REQUESTED]: 'true' },
      });
      if (phoneE164) this.syncCanonicalId(phoneE164, contactId, r);
      this.log.log(`opt-in WhatsApp: contacto ${contactId} -> ${HUBSPOT.PROP_OPTIN_REQUESTED}=true`);
      return true;
    } catch (err) {
      this.log.warn(`opt-in WhatsApp falló (contacto ${contactId}): ${(err as Error).message.slice(0, 160)}`);
      return false;
    }
  }

  async findContactByContratoId(contratoId: string): Promise<string> {
    if (!this.token || !contratoId) return '';
    try {
      const r = await this.call('POST', HUBSPOT.CONTACTS_SEARCH, {
        filterGroups: [
          { filters: [{ propertyName: HUBSPOT.PROP_CONTRACT_ID, operator: 'EQ', value: contratoId }] },
        ],
        properties: [HUBSPOT.PROP_PHONE, HUBSPOT.PROP_WHATSAPP_PHONE, HUBSPOT.PROP_CONTRACT_ID],
        limit: HUBSPOT.SEARCH_LIMIT,
      });
      const results: HsContact[] = r?.results ?? [];
      if (!results.length) return '';
      if (results.length > 1) {

        this.log.warn(
          `contrato_id ${contratoId} en ${results.length} contactos [${results.map((c) => c.id).join(', ')}] — se usa el que tenga WhatsApp`,
        );
      }
      const picked = results.find((c) => (c.properties?.[HUBSPOT.PROP_WHATSAPP_PHONE] || '').trim()) ?? results[0];
      return picked?.id ?? '';
    } catch (err) {
      this.log.error(`fallo buscando contacto por contrato_id ${contratoId}: ${(err as Error).message.slice(0, 160)}`);
      return '';
    }
  }

  async markOptInAndContract(contactId: string, contratoId: string): Promise<boolean> {
    if (!this.token || !contactId) return false;
    try {
      await this.call('PATCH', `${HUBSPOT.CONTACTS}/${contactId}`, {
        properties: {
          [HUBSPOT.PROP_OPTIN_REQUESTED]: 'true',
          [HUBSPOT.PROP_CONTRACT_ID]: contratoId,
        },
      });
      this.log.log(`contacto ${contactId} -> ${HUBSPOT.PROP_OPTIN_REQUESTED}=true, ${HUBSPOT.PROP_CONTRACT_ID}=${contratoId}`);
      return true;
    } catch (err) {
      this.log.error(`fallo marcando opt-in/contrato en ${contactId} (${contratoId}): ${(err as Error).message.slice(0, 160)}`);
      return false;
    }
  }

  async registrarCliente(phoneE164: string, nombre: string): Promise<string> {
    if (!this.token || !phoneE164) return '';
    try {
      const contact = await this.resolveByPhone(phoneE164, { firstName: nombre || undefined });

      const properties: Record<string, string> = {
        [HUBSPOT.PROP_PHONE]: phoneE164,
        [HUBSPOT.PROP_MOBILEPHONE]: phoneE164,
        [HUBSPOT.PROP_WHATSAPP_PHONE]: phoneE164,
        [HUBSPOT.PROP_OPTIN_REQUESTED]: 'true',
        ...(nombre ? { [HUBSPOT.PROP_FIRSTNAME]: nombre } : {}),
      };
      const r = await this.call('PATCH', `${HUBSPOT.CONTACTS}/${contact.id}`, { properties });
      this.syncCanonicalId(phoneE164, contact.id, r);
      const id = r?.id ?? contact.id;
      this.log.log(
        `registrarCliente(): contacto ${id} (${phoneE164}${contact.existed ? '' : ', CREADO'}) -> nombre="${nombre}", phone/mobilephone/whatsapp + opt-in`,
      );
      return id;
    } catch (err) {
      this.log.error(`registrarCliente(): fallo para ${phoneE164}: ${(err as Error).message.slice(0, 200)}`);
      return '';
    }
  }

  async waitForOptInApplied(contactId: string): Promise<boolean> {
    if (!this.token || !contactId) return false;
    const deadline = Date.now() + HUBSPOT.OPTIN_POLL_TIMEOUT_MS;
    for (;;) {
      try {
        const r = await this.call(
          'GET',
          `${HUBSPOT.CONTACTS}/${contactId}?properties=${HUBSPOT.PROP_OPTIN_APPLIED}`,
        );
        if (String(r?.properties?.[HUBSPOT.PROP_OPTIN_APPLIED] ?? '') === 'true') {

          this.log.log(`opt-in APLICADO confirmado para el contacto ${contactId} (no implica suscripción vigente: un ALTO posterior da de baja)`);
          return true;
        }
      } catch (err) {
        this.log.warn(`polling de opt-in falló (${contactId}): ${(err as Error).message.slice(0, 120)}`);
      }
      if (Date.now() >= deadline) {
        this.log.warn(`optin_no_confirmado: el contacto ${contactId} no reportó ${HUBSPOT.PROP_OPTIN_APPLIED}=true en ${HUBSPOT.OPTIN_POLL_TIMEOUT_MS}ms — se continúa igual`);
        return false;
      }
      await new Promise((r) => setTimeout(r, HUBSPOT.OPTIN_POLL_INTERVAL_MS));
    }
  }

  async addThreadNote(contactId: string, threadId: string): Promise<boolean> {
    if (!this.token || !contactId || !threadId) return false;
    try {
      const portalId = (process.env.HUBSPOT_PORTAL_ID || '').trim();
      const url = HUBSPOT.INBOX_THREAD_URL.replace('{portalId}', portalId).replace('{threadId}', threadId);
      await this.call('POST', HUBSPOT.NOTES, {
        properties: {

          hs_timestamp: new Date().toISOString(),
          hs_note_body: `Conversación de WhatsApp iniciada: ${url}`,
        },
        associations: [
          {
            to: { id: contactId },
            types: [
              {
                associationCategory: 'HUBSPOT_DEFINED',
                associationTypeId: HUBSPOT.NOTE_TO_CONTACT_TYPE_ID,
              },
            ],
          },
        ],
      });
      this.log.log(`nota con el hilo ${threadId} agregada al contacto ${contactId}`);
      return true;
    } catch (err) {
      this.log.warn(`no se pudo crear la nota del hilo ${threadId} (${contactId}): ${(err as Error).message.slice(0, 160)}`);
      return false;
    }
  }

  async setEmail(contactId: string, correo: string): Promise<void> {
    if (!this.token || !contactId || !correo) return;
    try {
      await this.call('PATCH', `${HUBSPOT.CONTACTS}/${contactId}`, {
        properties: { [HUBSPOT.PROP_EMAIL]: correo },
      });
      this.log.log(`contacto ${contactId} -> ${HUBSPOT.PROP_EMAIL}=${correo}`);
    } catch (err) {
      this.log.warn(`no se pudo escribir ${HUBSPOT.PROP_EMAIL} en ${contactId}: ${(err as Error).message.slice(0, 160)}`);
    }
  }

  async contactExists(contactId: string): Promise<boolean> {
    if (!this.token || !contactId) return false;
    try {
      await this.call('GET', `${HUBSPOT.CONTACTS}/${contactId}`);
      return true;
    } catch {
      return false;
    }
  }

  async resolveOrCreateByPhone(phoneRaw: string, nombreCompleto?: string): Promise<string> {

    const [nombrePila, ...resto] = (nombreCompleto || '').trim().split(/\s+/);
    const phoneE164 = normalizePhone(phoneRaw);
    if (!phoneE164) {
      this.log.warn(`deliveryIdentifier "${phoneRaw}" no es un móvil válido — no se crea contacto`);
      return '';
    }
    try {
      const c = await this.resolveByPhone(phoneE164, {
        firstName: nombrePila || undefined,
        lastName: resto.length ? resto.join(' ') : undefined,
      });
      return c.id;
    } catch (err) {
      this.log.error(`no se pudo resolver/crear contacto para ${phoneE164}: ${(err as Error).message.slice(0, 160)}`);
      return '';
    }
  }

  async setFacturaUrl(telefonoRaw: string, correo: string, url: string, contratoId: string): Promise<boolean> {
    if (!this.token) {
      this.log.warn('HUBSPOT_TOKEN no configurado; no se puede escribir factura_url');
      return false;
    }
    try {
      const phoneE164 = normalizePhone(telefonoRaw);
      if (!phoneE164) {
        this.log.warn(`factura_url: teléfono no normalizable ("${telefonoRaw}") para ${contratoId}`);
        return false;
      }
      const contact = await this.resolveByPhone(phoneE164, {});
      const r = await this.call('PATCH', `${HUBSPOT.CONTACTS}/${contact.id}`, {
        properties: { [HUBSPOT.PROP_INVOICE_URL]: url },
      });
      this.syncCanonicalId(phoneE164, contact.id, r);
      this.log.log(`HubSpot: contacto ${r?.id ?? contact.id} -> ${HUBSPOT.PROP_INVOICE_URL} (contrato ${contratoId})`);
      return true;
    } catch (err) {
      this.log.error(`HubSpot: fallo escribiendo ${HUBSPOT.PROP_INVOICE_URL} (${contratoId}): ${(err as Error).message}`);
      return false;
    }
  }

  private async setInvoiceUrl(contactId: string, url: string, contratoId: string): Promise<void> {
    try {
      await this.call('PATCH', `${HUBSPOT.CONTACTS}/${contactId}`, {
        properties: { [HUBSPOT.PROP_INVOICE_URL]: url },
      });
      this.log.log(`HubSpot: contacto ${contactId} -> ${HUBSPOT.PROP_INVOICE_URL} actualizado (contrato ${contratoId})`);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('PROPERTY_DOESNT_EXIST')) {
        this.log.warn(
          `HubSpot: la propiedad "${HUBSPOT.PROP_INVOICE_URL}" no existe en el portal — pídele al admin crearla (single-line text) para que el workflow pueda enviar el enlace de la factura`,
        );
      } else {
        this.log.warn(`HubSpot: fallo actualizando ${HUBSPOT.PROP_INVOICE_URL} (contrato ${contratoId}): ${msg}`);
      }
    }
  }

  async ensureContact(telefonoRaw: string, nombreCompleto?: string): Promise<boolean> {
    if (!this.token) return false;
    try {
      const phoneE164 = normalizePhone(telefonoRaw);
      if (!phoneE164) return false;
      const c = await this.resolveByPhone(phoneE164, {
        firstName: (nombreCompleto || '').split(' ')[0] || undefined,
      });
      if (!c.existed) this.log.log(`HubSpot: pre-registro creó contacto ${c.id} para ${phoneE164}`);

      return await this.ensureWhatsAppOptIn(c.id, phoneE164);
    } catch (err) {
      this.log.warn(`HubSpot: pre-registro falló para "${telefonoRaw}": ${(err as Error).message}`);
      return false;
    }
  }

  private async resolveByPhone(phoneE164: string, seed: ContactSeed): Promise<ResolvedContact> {
    // Serializar por teléfono evita crear contactos duplicados en llamadas simultáneas.

    const prev = this.inFlight.get(phoneE164) ?? Promise.resolve();
    const run = prev.catch(() => undefined).then(() => this.resolveByPhoneUnsafe(phoneE164, seed));
    this.inFlight.set(phoneE164, run.then(() => undefined, () => undefined));
    try {
      return await run;
    } finally {
      if (this.inFlight.get(phoneE164) === undefined) this.inFlight.delete(phoneE164);
    }
  }

  private async resolveByPhoneUnsafe(phoneE164: string, seed: ContactSeed): Promise<ResolvedContact> {
    const cached = this.contactIdByPhone.get(phoneE164);
    if (cached) return { id: cached, phoneE164, existed: true };

    const body = {
      filterGroups: [
        { filters: [{ propertyName: HUBSPOT.PROP_WHATSAPP_PHONE, operator: 'EQ', value: phoneE164 }] },
        { filters: [{ propertyName: HUBSPOT.PROP_PHONE, operator: 'EQ', value: phoneE164 }] },
        { filters: [{ propertyName: HUBSPOT.PROP_MOBILEPHONE, operator: 'EQ', value: phoneE164 }] },
      ],
      properties: [
        HUBSPOT.PROP_PHONE,
        HUBSPOT.PROP_MOBILEPHONE,
        HUBSPOT.PROP_WHATSAPP_PHONE,
        this.statusProperty,
        HUBSPOT.PROP_FIRSTNAME,
      ],
      limit: HUBSPOT.SEARCH_LIMIT,
    };
    const r = await this.call('POST', HUBSPOT.CONTACTS_SEARCH, body);
    const results: HsContact[] = r?.results ?? [];

    const picked = this.pickContact(results, phoneE164);
    if (picked) {
      this.contactIdByPhone.set(phoneE164, picked.id);
      return { id: picked.id, phoneE164, existed: true };
    }

    const properties: Record<string, string> = {

      [HUBSPOT.PROP_PHONE]: phoneE164,
      [HUBSPOT.PROP_MOBILEPHONE]: phoneE164,
      [HUBSPOT.PROP_WHATSAPP_PHONE]: phoneE164,

      [this.statusProperty]: HUBSPOT.PAYMENT_STATUS_PENDING,
      ...(seed.firstName ? { [HUBSPOT.PROP_FIRSTNAME]: seed.firstName } : {}),
      ...(seed.lastName ? { [HUBSPOT.PROP_LASTNAME]: seed.lastName } : {}),
    };
    const created = await this.call('POST', HUBSPOT.CONTACTS, { properties });
    const id: string = created?.id ?? '';
    if (!id) throw new Error(`create de contacto para ${phoneE164} no devolvió id`);
    this.contactIdByPhone.set(phoneE164, id);
    this.log.log(`HubSpot: contacto creado ${id} (${phoneE164})`);
    return { id, phoneE164, existed: false };
  }

  // Pasar por pendiente permite reactivar el workflow para pagos consecutivos.
  private async setPaymentStatus(contactId: string, payment: PaymentUpdate, phoneE164 = ''): Promise<void> {
    try {
      await this.call('PATCH', `${HUBSPOT.CONTACTS}/${contactId}`, {
        properties: { [this.statusProperty]: HUBSPOT.PAYMENT_STATUS_PENDING },
      });
    } catch (err) {
      this.log.warn(`HubSpot: PATCH previo a "${HUBSPOT.PAYMENT_STATUS_PENDING}" falló (${contactId}): ${(err as Error).message} — se continúa con el PATCH principal`);
    }

    const properties: Record<string, string> = {
      [this.statusProperty]: payment.status,
      [HUBSPOT.PROP_PAYMENT_AMOUNT]: payment.amount.toFixed(2),
      [HUBSPOT.PROP_PAYMENT_DATE]: payment.date,
      [HUBSPOT.PROP_CONTRACT_ID]: payment.contratoId,
    };
    const r = await this.call('PATCH', `${HUBSPOT.CONTACTS}/${contactId}`, { properties });
    if (phoneE164) this.syncCanonicalId(phoneE164, contactId, r);
  }

  private syncCanonicalId(phoneE164: string, usedId: string, response: any): void {
    const canonical: string | undefined = response?.id;
    if (canonical && canonical !== usedId) {
      this.log.warn(`HubSpot: id canónico cambió (${usedId} -> ${canonical}) para ${phoneE164} — HubSpot fusionó contactos; cache actualizado`);
      this.contactIdByPhone.set(phoneE164, canonical);
    }
  }

  private pickContact(results: HsContact[], phoneE164: string): HsContact | undefined {
    if (!results.length) return undefined;
    if (results.length > 1) {
      this.log.warn(
        `HubSpot: ${results.length} contactos DUPLICADOS para ${phoneE164}: ${results.map((c) => c.id).join(', ')} — hacer merge en HubSpot; se usa el que tenga WhatsApp`,
      );
    }
    return results.find((c) => (c.properties?.[HUBSPOT.PROP_WHATSAPP_PHONE] || '').trim()) ?? results[0];
  }

  private async call(method: string, path: string, body?: unknown): Promise<any> {
    const res = await fetch(`${HUBSPOT.BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    this.log.debug(`HubSpot ${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
    if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  }
}
