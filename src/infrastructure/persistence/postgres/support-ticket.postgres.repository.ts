import { Injectable } from '@nestjs/common';
import { SupportTicket, SupportTicketProps } from '../../../domain/entities/support-ticket.entity';
import { SupportTicketRepository } from '../../../domain/repositories/support-ticket.repository';
import { ConflictError } from '../../../domain/errors/domain.error';
import { DatabaseService } from './database.service';

interface TicketRow {
  id: string;
  phone: string;
  reason: string;
  context: string | null;
  created_at: Date;
}

const COLUMNS = 'id, phone, reason, context, created_at';
const UNIQUE_VIOLATION = '23505';

@Injectable()
export class SupportTicketPostgresRepository implements SupportTicketRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(ticket: SupportTicket): Promise<SupportTicket> {
    const props = ticket.toJSON();
    try {
      const { rows } = await this.db.query<TicketRow>(
        `INSERT INTO support_tickets (${COLUMNS})
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${COLUMNS}`,
        [props.id, props.phone, props.reason, props.context ?? null, props.createdAt],
      );
      return this.toEntity(rows[0]!);
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new ConflictError(`Ticket ${props.id} already exists`);
      }
      throw error;
    }
  }

  async findById(id: string): Promise<SupportTicket | null> {
    const { rows } = await this.db.query<TicketRow>(
      `SELECT ${COLUMNS} FROM support_tickets WHERE id = $1`,
      [id],
    );
    const row = rows[0];
    return row ? this.toEntity(row) : null;
  }

  async findByPhone(phone: string, limit = 10): Promise<SupportTicket[]> {
    const cap = Math.min(Math.max(limit, 1), 100);
    const { rows } = await this.db.query<TicketRow>(
      `SELECT ${COLUMNS} FROM support_tickets
        WHERE phone = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [phone, cap],
    );
    return rows.map((row) => this.toEntity(row));
  }

  async nextSequence(): Promise<number> {
    const { rows } = await this.db.query<{ value: string }>(
      `SELECT nextval('support_tickets_seq') AS value`,
    );
    return Number(rows[0]!.value);
  }

  private toEntity(row: TicketRow): SupportTicket {
    const props: SupportTicketProps = {
      id: row.id,
      phone: row.phone,
      reason: row.reason,
      context: row.context ?? undefined,
      createdAt: row.created_at,
    };
    return SupportTicket.fromPersistence(props);
  }
}
