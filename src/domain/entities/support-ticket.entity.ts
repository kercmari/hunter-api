import { DomainError } from '../errors/domain.error';

export interface SupportTicketProps {
  readonly id: string;
  readonly phone: string;
  readonly reason: string;
  readonly context?: string;
  readonly createdAt: Date;
}

export class SupportTicket {
  private constructor(private readonly props: SupportTicketProps) {}

  static create(props: Omit<SupportTicketProps, 'createdAt'>): SupportTicket {
    if (!props.id?.trim()) throw new DomainError('A ticket requires an identifier');
    if (!props.phone?.trim()) throw new DomainError('A ticket requires a phone number');
    if (!props.reason?.trim()) throw new DomainError('A ticket requires a reason');
    return new SupportTicket({ ...props, createdAt: new Date() });
  }

  static fromPersistence(props: SupportTicketProps): SupportTicket {
    return new SupportTicket(props);
  }

  get id(): string { return this.props.id; }
  get phone(): string { return this.props.phone; }
  get reason(): string { return this.props.reason; }
  get context(): string | undefined { return this.props.context; }
  get createdAt(): Date { return this.props.createdAt; }

  toJSON(): SupportTicketProps {
    return { ...this.props };
  }
}
