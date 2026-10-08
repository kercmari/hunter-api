import { Inject, Injectable, Logger } from '@nestjs/common';
import { SupportTicket } from '../../domain/entities/support-ticket.entity';
import {
  SUPPORT_TICKET_REPOSITORY,
  SupportTicketRepository,
} from '../../domain/repositories/support-ticket.repository';
import { CreateTicketCommand } from '../dto/create-ticket.command';

@Injectable()
export class EscalateConversationUseCase {
  private readonly logger = new Logger(EscalateConversationUseCase.name);

  constructor(
    @Inject(SUPPORT_TICKET_REPOSITORY) private readonly tickets: SupportTicketRepository,
  ) {}

  async execute(command: CreateTicketCommand): Promise<SupportTicket> {
    const sequence = await this.tickets.nextSequence();
    const ticket = SupportTicket.create({
      id: `TK-${String(sequence).padStart(6, '0')}`,
      phone: command.phone,
      reason: command.reason,
      context: command.context,
    });

    const saved = await this.tickets.create(ticket);
    this.logger.log(`Ticket ${saved.id} created: ${saved.reason}`);
    return saved;
  }

  listByPhone(phone: string, limit = 10): Promise<SupportTicket[]> {
    return this.tickets.findByPhone(phone, limit);
  }
}
