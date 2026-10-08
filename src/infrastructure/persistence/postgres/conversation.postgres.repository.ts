import { Injectable } from '@nestjs/common';
import { Conversation, ConversationProps } from '../../../domain/entities/conversation.entity';
import { ConversationRepository } from '../../../domain/repositories/conversation.repository';
import { DatabaseService } from './database.service';

interface ConversationRow {
  thread_id: string;
  contact_id: string | null;
  phone: string | null;
  last_message_id: string | null;
  resolved_at: Date;
}

const COLUMNS = 'thread_id, contact_id, phone, last_message_id, resolved_at';

@Injectable()
export class ConversationPostgresRepository implements ConversationRepository {
  constructor(private readonly db: DatabaseService) {}

  async findByThread(threadId: string): Promise<Conversation | null> {
    const { rows } = await this.db.query<ConversationRow>(
      `SELECT ${COLUMNS} FROM conversations WHERE thread_id = $1`,
      [threadId],
    );
    const row = rows[0];
    return row ? this.toEntity(row) : null;
  }

  async findByPhone(phone: string): Promise<Conversation | null> {
    const { rows } = await this.db.query<ConversationRow>(
      `SELECT ${COLUMNS} FROM conversations
        WHERE phone = $1
        ORDER BY resolved_at DESC
        LIMIT 1`,
      [phone],
    );
    const row = rows[0];
    return row ? this.toEntity(row) : null;
  }

  async save(conversation: Conversation): Promise<Conversation> {
    const props = conversation.toJSON();
    const { rows } = await this.db.query<ConversationRow>(
      `INSERT INTO conversations (${COLUMNS})
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (thread_id) DO UPDATE
          SET contact_id      = COALESCE(EXCLUDED.contact_id, conversations.contact_id),
              phone           = COALESCE(EXCLUDED.phone, conversations.phone),
              last_message_id = COALESCE(EXCLUDED.last_message_id, conversations.last_message_id),
              resolved_at     = EXCLUDED.resolved_at
       RETURNING ${COLUMNS}`,
      [props.threadId, props.contactId ?? null, props.phone ?? null, props.lastMessageId ?? null, props.resolvedAt],
    );
    return this.toEntity(rows[0]!);
  }

  async markMessageProcessed(messageId: string): Promise<boolean> {
    if (!messageId) return true;
    const { rowCount } = await this.db.query(
      `INSERT INTO processed_messages (message_id)
       VALUES ($1)
       ON CONFLICT (message_id) DO NOTHING`,
      [messageId],
    );
    return rowCount > 0;
  }

  private toEntity(row: ConversationRow): Conversation {
    const props: ConversationProps = {
      threadId: row.thread_id,
      contactId: row.contact_id ?? undefined,
      phone: row.phone ?? undefined,
      lastMessageId: row.last_message_id ?? undefined,
      resolvedAt: row.resolved_at,
    };
    return Conversation.fromPersistence(props);
  }
}
