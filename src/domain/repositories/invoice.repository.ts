import { Invoice } from '../entities/invoice.entity';

export interface InvoiceRepository {
  findByContract(contractId: string): Promise<Invoice | null>;

  getDocument(contractId: string): Promise<Buffer | null>;
  save(invoice: Invoice, document: Buffer): Promise<Invoice>;
}

export const INVOICE_REPOSITORY = Symbol('InvoiceRepository');
