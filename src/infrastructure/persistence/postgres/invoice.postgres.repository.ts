import { Injectable } from '@nestjs/common';
import { Invoice, InvoiceProps } from '../../../domain/entities/invoice.entity';
import { InvoiceRepository } from '../../../domain/repositories/invoice.repository';
import { DatabaseService } from './database.service';

interface InvoiceRow {
  id: string;
  contract_id: string;
  hash: string;
  bytes: number;
  issued_at: Date;
}

const COLUMNS = 'id, contract_id, hash, bytes, issued_at';

@Injectable()
export class InvoicePostgresRepository implements InvoiceRepository {
  constructor(private readonly db: DatabaseService) {}

  async findByContract(contractId: string): Promise<Invoice | null> {
    const { rows } = await this.db.query<InvoiceRow>(
      `SELECT ${COLUMNS} FROM invoices WHERE contract_id = $1`,
      [contractId],
    );
    const row = rows[0];
    return row ? this.toEntity(row) : null;
  }

  async getDocument(contractId: string): Promise<Buffer | null> {
    const { rows } = await this.db.query<{ document: Buffer }>(
      `SELECT document FROM invoices WHERE contract_id = $1`,
      [contractId],
    );
    return rows[0]?.document ?? null;
  }

  async save(invoice: Invoice, document: Buffer): Promise<Invoice> {
    const props = invoice.toJSON();
    const { rows } = await this.db.query<InvoiceRow>(
      `INSERT INTO invoices (id, contract_id, hash, bytes, document, issued_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (contract_id) DO NOTHING
       RETURNING ${COLUMNS}`,
      [props.id, props.contractId, props.hash, props.bytes, document, props.issuedAt],
    );

    const row = rows[0];
    if (row) return this.toEntity(row);

    const existing = await this.findByContract(props.contractId);
    if (!existing) {
      throw new Error(`Receipt for ${props.contractId} could not be stored or retrieved`);
    }
    return existing;
  }

  private toEntity(row: InvoiceRow): Invoice {
    const props: InvoiceProps = {
      id: row.id,
      contractId: row.contract_id,
      hash: row.hash,
      bytes: Number(row.bytes),
      issuedAt: row.issued_at,
    };
    return Invoice.fromPersistence(props);
  }
}
