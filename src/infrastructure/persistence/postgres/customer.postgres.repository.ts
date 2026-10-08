import { Inject, Injectable } from '@nestjs/common';
import { Customer, CustomerProps } from '../../../domain/entities/customer.entity';
import { CustomerRepository } from '../../../domain/repositories/customer.repository';
import { DatabaseService } from './database.service';

interface CustomerRow {
  phone: string;
  full_name: string | null;
  tax_id: string | null;
  email: string | null;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS = 'phone, full_name, tax_id, email, created_at, updated_at';

@Injectable()
export class CustomerPostgresRepository implements CustomerRepository {
  constructor(@Inject(DatabaseService) private readonly db: Pick<DatabaseService, 'query'>) {}

  async findByPhone(phone: string): Promise<Customer | null> {
    const { rows } = await this.db.query<CustomerRow>(
      `SELECT ${COLUMNS} FROM customers WHERE phone = $1`,
      [phone],
    );
    const row = rows[0];
    return row ? this.toEntity(row) : null;
  }

  async findByTaxId(taxId: string): Promise<Customer | null> {
    const { rows } = await this.db.query<CustomerRow>(
      `SELECT ${COLUMNS} FROM customers
        WHERE tax_id = $1
        ORDER BY updated_at DESC
        LIMIT 1`,
      [taxId],
    );
    const row = rows[0];
    return row ? this.toEntity(row) : null;
  }

  async save(customer: Customer): Promise<Customer> {
    const props = customer.toJSON();
    const { rows } = await this.db.query<CustomerRow>(
      `INSERT INTO customers (phone, full_name, tax_id, email, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (phone) DO UPDATE
          SET full_name  = COALESCE(EXCLUDED.full_name, customers.full_name),
              tax_id     = COALESCE(EXCLUDED.tax_id,    customers.tax_id),
              email      = COALESCE(EXCLUDED.email,     customers.email),
              updated_at = EXCLUDED.updated_at
       RETURNING ${COLUMNS}`,
      [
        props.phone,
        props.fullName ?? null,
        props.taxId ?? null,
        props.email ?? null,
        props.createdAt,
        props.updatedAt,
      ],
    );
    return this.toEntity(rows[0]!);
  }

  private toEntity(row: CustomerRow): Customer {
    const props: CustomerProps = {
      phone: row.phone,
      fullName: row.full_name ?? undefined,
      taxId: row.tax_id ?? undefined,
      email: row.email ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    return Customer.fromPersistence(props);
  }
}
