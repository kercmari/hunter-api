import { Inject, Injectable } from '@nestjs/common';
import { Contract, ContractProps, ContractType, PaymentStatus } from '../../../domain/entities/contract.entity';
import { ContractRepository } from '../../../domain/repositories/contract.repository';
import { ConflictError } from '../../../domain/errors/domain.error';
import { DatabaseService } from './database.service';

interface ContractRow {
  id: string;
  vehicle: unknown;
  type: string;

  amount: string;
  tax_id: string;
  product_code: string;
  full_name: string;
  email: string;
  phone: string;
  payment_status: string;
  created_at: Date;
  payment_updated_at: Date | null;
}

const COLUMNS = `id, type, amount, tax_id, product_code,
                 full_name, email, phone, payment_status,
                 created_at, payment_updated_at, vehicle`;

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class ContractPostgresRepository implements ContractRepository {
  constructor(@Inject(DatabaseService) private readonly db: Pick<DatabaseService, 'query'>) {}

  async findById(id: string): Promise<Contract | null> {
    const { rows } = await this.db.query<ContractRow>(
      `SELECT ${COLUMNS} FROM contracts WHERE id = $1`,
      [id],
    );
    const row = rows[0];
    return row ? this.toEntity(row) : null;
  }

  async create(contract: Contract): Promise<Contract> {
    const props = contract.toJSON();
    try {
      const { rows } = await this.db.query<ContractRow>(
        `INSERT INTO contracts (${COLUMNS})
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING ${COLUMNS}`,
        [
          props.id, props.type, props.amount, props.taxId, props.productCode,
          props.fullName, props.email, props.phone, props.paymentStatus,
          props.createdAt, props.paymentUpdatedAt ?? null, JSON.stringify(props.vehicle ?? null),
        ],
      );
      return this.toEntity(rows[0]!);
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new ConflictError(`Contract ${props.id} already exists`);
      }
      throw error;
    }
  }

  async update(contract: Contract): Promise<Contract> {
    const props = contract.toJSON();
    const { rows } = await this.db.query<ContractRow>(
      `UPDATE contracts
          SET payment_status = $2, payment_updated_at = $3
        WHERE id = $1
      RETURNING ${COLUMNS}`,
      [props.id, props.paymentStatus, props.paymentUpdatedAt ?? null],
    );
    const row = rows[0];
    if (!row) throw new ConflictError(`Contract ${props.id} could not be updated`);
    return this.toEntity(row);
  }

  async nextSequence(): Promise<number> {
    const { rows } = await this.db.query<{ value: string }>(
      `SELECT nextval('contracts_seq') AS value`,
    );
    return Number(rows[0]!.value);
  }

  async findByPhone(phone: string, limit = 20): Promise<Contract[]> {
    const cap = Math.min(Math.max(limit, 1), 100);
    const { rows } = await this.db.query<ContractRow>(
      `SELECT ${COLUMNS} FROM contracts
        WHERE phone = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [phone, cap],
    );
    return rows.map((row) => this.toEntity(row));
  }

  private toEntity(row: ContractRow): Contract {
    const props: ContractProps = {
      id: row.id,
      vehicle: row.vehicle,
      type: row.type as ContractType,
      amount: Number(row.amount),
      taxId: row.tax_id,
      productCode: row.product_code,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      paymentStatus: row.payment_status as PaymentStatus,
      createdAt: row.created_at,
      paymentUpdatedAt: row.payment_updated_at ?? undefined,
    };
    return Contract.fromPersistence(props);
  }
}
