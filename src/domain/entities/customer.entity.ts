import { DomainError } from '../errors/domain.error';

export interface CustomerProps {
  readonly phone: string;
  readonly fullName?: string;
  readonly taxId?: string;
  readonly email?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class Customer {
  private constructor(private readonly props: CustomerProps) {}

  static create(props: Omit<CustomerProps, 'createdAt' | 'updatedAt'>): Customer {
    if (!props.phone?.trim()) throw new DomainError('A customer requires a phone number');
    const now = new Date();
    return new Customer({ ...props, createdAt: now, updatedAt: now });
  }

  static fromPersistence(props: CustomerProps): Customer {
    return new Customer(props);
  }

  get phone(): string { return this.props.phone; }
  get fullName(): string | undefined { return this.props.fullName; }
  get taxId(): string | undefined { return this.props.taxId; }
  get email(): string | undefined { return this.props.email; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  mergeWith(details: Partial<Omit<CustomerProps, 'phone' | 'createdAt' | 'updatedAt'>>): Customer {
    return new Customer({
      ...this.props,
      fullName: details.fullName?.trim() || this.props.fullName,
      taxId: details.taxId?.trim() || this.props.taxId,
      email: details.email?.trim() || this.props.email,
      updatedAt: new Date(),
    });
  }

  toJSON(): CustomerProps {
    return { ...this.props };
  }
}
