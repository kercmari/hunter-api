import { DomainError } from '../errors/domain.error';

export interface InvoiceProps {
  readonly id: string;
  readonly contractId: string;

  readonly hash: string;
  readonly bytes: number;
  readonly issuedAt: Date;
}

// Comprobante sin firma electrónica ni autorización tributaria.
export class Invoice {
  private constructor(private readonly props: InvoiceProps) {}

  static create(props: Omit<InvoiceProps, 'issuedAt'>): Invoice {
    if (!props.contractId?.trim()) throw new DomainError('An invoice requires a contract');
    if (!props.hash?.trim()) throw new DomainError('An invoice requires its hash');
    if (!Number.isInteger(props.bytes) || props.bytes <= 0) {
      throw new DomainError('An invoice requires a valid size');
    }
    return new Invoice({ ...props, issuedAt: new Date() });
  }

  static fromPersistence(props: InvoiceProps): Invoice {
    return new Invoice(props);
  }

  get id(): string { return this.props.id; }
  get contractId(): string { return this.props.contractId; }
  get hash(): string { return this.props.hash; }
  get bytes(): number { return this.props.bytes; }
  get issuedAt(): Date { return this.props.issuedAt; }

  toJSON(): InvoiceProps {
    return { ...this.props };
  }
}
