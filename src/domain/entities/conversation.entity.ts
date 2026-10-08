import { DomainError } from '../errors/domain.error';

export interface ConversationProps {
  readonly threadId: string;
  readonly contactId?: string;

  readonly phone?: string;
  readonly lastMessageId?: string;
  readonly resolvedAt: Date;
}

export class Conversation {
  private constructor(private readonly props: ConversationProps) {}

  static create(props: Omit<ConversationProps, 'resolvedAt'>): Conversation {
    if (!props.threadId?.trim()) throw new DomainError('A conversation requires a thread identifier');
    return new Conversation({ ...props, resolvedAt: new Date() });
  }

  static fromPersistence(props: ConversationProps): Conversation {
    return new Conversation(props);
  }

  get threadId(): string { return this.props.threadId; }
  get contactId(): string | undefined { return this.props.contactId; }
  get phone(): string | undefined { return this.props.phone; }
  get lastMessageId(): string | undefined { return this.props.lastMessageId; }
  get resolvedAt(): Date { return this.props.resolvedAt; }

  get isIdentified(): boolean {
    return Boolean(this.props.phone);
  }

  toJSON(): ConversationProps {
    return { ...this.props };
  }
}
