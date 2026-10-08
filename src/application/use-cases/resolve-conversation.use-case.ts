import { Inject, Injectable, Logger } from '@nestjs/common';
import { Conversation } from '../../domain/entities/conversation.entity';
import {
  CONVERSATION_REPOSITORY,
  ConversationRepository,
} from '../../domain/repositories/conversation.repository';
import { CRM_PORT, CrmPort } from '../ports/crm.port';

export interface ConversationEvent {
  readonly threadId: string;
  readonly messageId?: string;
}

@Injectable()
export class ResolveConversationUseCase {
  private readonly logger = new Logger(ResolveConversationUseCase.name);

  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepository,
    @Inject(CRM_PORT) private readonly crm: CrmPort,
  ) {}

  async execute(event: ConversationEvent): Promise<Conversation | null> {
    if (!event.threadId) return null;

    if (event.messageId) {
      const isNew = await this.conversations.markMessageProcessed(event.messageId);
      if (!isNew) {
        this.logger.debug(`Message ${event.messageId} already handled, ignoring retry.`);
        return this.conversations.findByThread(event.threadId);
      }
    }

    const identity = await this.crm.resolveThread(event.threadId);
    if (!identity) return null;

    const conversation = Conversation.create({
      threadId: identity.threadId,
      contactId: identity.contactId,
      phone: identity.phone,
      lastMessageId: event.messageId,
    });

    const saved = await this.conversations.save(conversation);
    this.logger.log(
      `Thread ${saved.threadId} resolved` +
        (saved.isIdentified ? ' with a phone number.' : ' without a phone number.'),
    );
    return saved;
  }

  findByThread(threadId: string): Promise<Conversation | null> {
    return this.conversations.findByThread(threadId);
  }

  findByPhone(phone: string): Promise<Conversation | null> {
    return this.conversations.findByPhone(phone);
  }
}
