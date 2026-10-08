import { Conversation } from '../entities/conversation.entity';

export interface ConversationRepository {
  findByThread(threadId: string): Promise<Conversation | null>;
  findByPhone(phone: string): Promise<Conversation | null>;
  save(conversation: Conversation): Promise<Conversation>;

  markMessageProcessed(messageId: string): Promise<boolean>;
}

export const CONVERSATION_REPOSITORY = Symbol('ConversationRepository');
