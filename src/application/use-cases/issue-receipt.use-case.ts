import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { Invoice } from '../../domain/entities/invoice.entity';
import { NotFoundError } from '../../domain/errors/domain.error';
import { CONTRACT_REPOSITORY, ContractRepository } from '../../domain/repositories/contract.repository';
import { INVOICE_REPOSITORY, InvoiceRepository } from '../../domain/repositories/invoice.repository';
import { DOCUMENT_GENERATOR, DocumentGenerator } from '../ports/document-generator.port';

export interface IssuedReceipt {
  readonly contractId: string;
  readonly invoiceId: string;
  readonly hash: string;
  readonly bytes: number;
  readonly issuedAt: Date;

  readonly alreadyIssued: boolean;
}

@Injectable()
export class IssueReceiptUseCase {
  private readonly logger = new Logger(IssueReceiptUseCase.name);

  constructor(
    @Inject(CONTRACT_REPOSITORY) private readonly contracts: ContractRepository,
    @Inject(INVOICE_REPOSITORY) private readonly invoices: InvoiceRepository,
    @Inject(DOCUMENT_GENERATOR) private readonly generator: DocumentGenerator,
  ) {}

  async issue(contractId: string): Promise<IssuedReceipt> {
    const existing = await this.invoices.findByContract(contractId);
    if (existing) return this.result(existing, true);

    const contract = await this.contracts.findById(contractId);
    if (!contract) throw new NotFoundError('Contract', contractId);

    const document = await this.generator.generateReceipt(contract);
    const hash = createHash('sha256').update(document).digest('hex');

    const invoice = Invoice.create({
      id: `IN-${contract.id.replace(/^CT-/, '')}`,
      contractId: contract.id,
      hash,
      bytes: document.length,
    });

    const saved = await this.invoices.save(invoice, document);
    this.logger.log(`Receipt ${saved.id} issued for ${contract.id} (${saved.bytes} bytes).`);
    return this.result(saved, false);
  }

  async getDocument(contractId: string): Promise<{ document: Buffer; invoice: Invoice }> {
    let invoice = await this.invoices.findByContract(contractId);
    if (!invoice) {
      await this.issue(contractId);
      invoice = await this.invoices.findByContract(contractId);
    }
    if (!invoice) throw new NotFoundError('Receipt', contractId);

    const document = await this.invoices.getDocument(contractId);
    if (!document) throw new NotFoundError('Receipt document', contractId);
    return { document, invoice };
  }

  private result(invoice: Invoice, alreadyIssued: boolean): IssuedReceipt {
    return {
      contractId: invoice.contractId,
      invoiceId: invoice.id,
      hash: invoice.hash,
      bytes: invoice.bytes,
      issuedAt: invoice.issuedAt,
      alreadyIssued,
    };
  }
}
