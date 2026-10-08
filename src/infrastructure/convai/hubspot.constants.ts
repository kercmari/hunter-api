export const HUBSPOT = {
  BASE_URL: 'https://api.hubapi.com',
  CONTACTS_SEARCH: '/crm/v3/objects/contacts/search',
  CONTACTS: '/crm/v3/objects/contacts',
  NOTES: '/crm/v3/objects/notes',

  NOTE_TO_CONTACT_TYPE_ID: 202,

  INBOX_THREAD_URL: 'https://app.hubspot.com/live-messages/{portalId}/inbox/{threadId}',

  PROP_PHONE: 'phone',

  PROP_MOBILEPHONE: 'mobilephone',
  PROP_EMAIL: 'email',
  PROP_WHATSAPP_PHONE: 'hs_whatsapp_phone_number',
  PROP_FIRSTNAME: 'firstname',
  PROP_LASTNAME: 'lastname',
  PROP_PAYMENT_STATUS: 'pago_estado',
  PROP_PAYMENT_AMOUNT: 'pago_monto',
  PROP_PAYMENT_DATE: 'pago_fecha',
  PROP_INVOICE_URL: 'factura_url',

  PROP_CONTRACT_ID: 'contrato_id',

  PAYMENT_STATUS_CONFIRMED: 'confirmado',
  PAYMENT_STATUS_REJECTED: 'rechazado',
  PAYMENT_STATUS_PENDING: 'pendiente',

  SEARCH_LIMIT: 10, // >1 a propósito: con duplicados se elige el contacto de WhatsApp

  PROP_OPTIN_REQUESTED: 'whatsapp_optin_requested',

  PROP_OPTIN_APPLIED: 'whatsapp_optin_aplicado',

  OPTIN_POLL_INTERVAL_MS: 1500,
  OPTIN_POLL_TIMEOUT_MS: 10000,
} as const;
