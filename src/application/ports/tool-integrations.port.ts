export interface CustomerIdentity { contactId: string; phoneE164: string; }
export interface ConversationIdentityPort {
  findContactByText(taxId: string, email?: string): Promise<CustomerIdentity | null>;
}
export const CONVERSATION_IDENTITY = Symbol('ConversationIdentity');

export interface ContractContactPort {
  contactExists(id: string): Promise<boolean>;
  resolveOrCreateByPhone(phone: string, name?: string): Promise<string>;
  markOptInAndContract(contactId: string, contractId: string): Promise<boolean>;
  setEmail(contactId: string, email: string): Promise<void>;
}
export const CONTRACT_CONTACT = Symbol('ContractContact');

export interface InvoiceDeliveryPort {
  setFacturaUrl(phone: string, email: string, url: string, contractId: string): Promise<boolean>;
}
export const INVOICE_DELIVERY = Symbol('InvoiceDelivery');

export interface PaymentNotification {
  correo: string; nombre_completo: string; telefono: string; contrato_id: string;
  monto: number; fecha: string; estado: 'confirmado' | 'rechazado'; facturaUrl?: string;
}
export interface PaymentNotificationPort { notificarPago(notification: PaymentNotification): Promise<void>; }
export const PAYMENT_NOTIFICATION = Symbol('PaymentNotification');

export type AssetPurpose = 'pay' | 'receipt';
export interface AssetLinksPort {
  signedUrl(id: string, purpose: AssetPurpose): string;
  verify(id: string, purpose: AssetPurpose, expires: string, token: string): void;
}
export const ASSET_LINKS = Symbol('AssetLinks');
export interface CheckoutPolicyPort { assertDemoEnabled(): void; }
export const CHECKOUT_POLICY = Symbol('CheckoutPolicy');
