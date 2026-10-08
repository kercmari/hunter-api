import { Global, Module } from '@nestjs/common';
import { DatabaseConfig } from '../config/database.config';
import { DatabaseService } from './postgres/database.service';
import { ContractPostgresRepository } from './postgres/contract.postgres.repository';
import { CustomerPostgresRepository } from './postgres/customer.postgres.repository';
import { InvoicePostgresRepository } from './postgres/invoice.postgres.repository';
import { SupportTicketPostgresRepository } from './postgres/support-ticket.postgres.repository';
import { ConversationPostgresRepository } from './postgres/conversation.postgres.repository';
import { CONTRACT_REPOSITORY } from '../../domain/repositories/contract.repository';
import { CUSTOMER_REPOSITORY } from '../../domain/repositories/customer.repository';
import { INVOICE_REPOSITORY } from '../../domain/repositories/invoice.repository';
import { SUPPORT_TICKET_REPOSITORY } from '../../domain/repositories/support-ticket.repository';
import { CONVERSATION_REPOSITORY } from '../../domain/repositories/conversation.repository';

@Global()
@Module({
  providers: [
    DatabaseConfig,
    DatabaseService,
    { provide: CONTRACT_REPOSITORY, useClass: ContractPostgresRepository },
    { provide: CUSTOMER_REPOSITORY, useClass: CustomerPostgresRepository },
    { provide: INVOICE_REPOSITORY, useClass: InvoicePostgresRepository },
    { provide: SUPPORT_TICKET_REPOSITORY, useClass: SupportTicketPostgresRepository },
    { provide: CONVERSATION_REPOSITORY, useClass: ConversationPostgresRepository },
  ],
  exports: [
    DatabaseService,
    CONTRACT_REPOSITORY,
    CUSTOMER_REPOSITORY,
    INVOICE_REPOSITORY,
    SUPPORT_TICKET_REPOSITORY,
    CONVERSATION_REPOSITORY,
  ],
})
export class PersistenceModule {}
