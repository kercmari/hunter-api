import { SupportTicket } from '../entities/support-ticket.entity';

export interface SupportTicketRepository {
  create(ticket: SupportTicket): Promise<SupportTicket>;
  findById(id: string): Promise<SupportTicket | null>;
  findByPhone(phone: string, limit?: number): Promise<SupportTicket[]>;

  nextSequence(): Promise<number>;
}

export const SUPPORT_TICKET_REPOSITORY = Symbol('SupportTicketRepository');
