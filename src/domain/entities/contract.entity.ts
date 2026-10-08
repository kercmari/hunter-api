import { DomainError } from '../errors/domain.error';

export type ContractType = 'sale' | 'renewal';

export type PaymentStatus = 'pending' | 'confirmed' | 'rejected';

export interface ContractProps {
  readonly id: string;
  readonly type: ContractType;
  readonly amount: number;
  readonly taxId: string;
  readonly productCode: string;
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
  readonly vehicle?: unknown;
  readonly paymentStatus: PaymentStatus;
  readonly createdAt: Date;
  readonly paymentUpdatedAt?: Date;
}

export class Contract {
  private constructor(private readonly props: ContractProps) {}

  static create(props: Omit<ContractProps, 'paymentStatus' | 'createdAt'>): Contract {
    if (!props.id?.trim()) throw new DomainError('A contract requires an identifier');
    if (!Number.isFinite(props.amount) || props.amount <= 0) {
      throw new DomainError('Contract amount must be greater than zero');
    }
    if (!props.phone?.trim()) throw new DomainError('A contract requires a phone number');
    if (!props.taxId?.trim()) throw new DomainError('A contract requires a tax identifier');

    return new Contract({ ...props, paymentStatus: 'pending', createdAt: new Date() });
  }

  static fromPersistence(props: ContractProps): Contract {
    return new Contract(props);
  }

  get id(): string { return this.props.id; }
  get type(): ContractType { return this.props.type; }
  get amount(): number { return this.props.amount; }
  get taxId(): string { return this.props.taxId; }
  get productCode(): string { return this.props.productCode; }
  get fullName(): string { return this.props.fullName; }
  get email(): string { return this.props.email; }
  get phone(): string { return this.props.phone; }
  get paymentStatus(): PaymentStatus { return this.props.paymentStatus; }
  get createdAt(): Date { return this.props.createdAt; }
  get paymentUpdatedAt(): Date | undefined { return this.props.paymentUpdatedAt; }

  get isPaid(): boolean { return this.props.paymentStatus === 'confirmed'; }

  confirmPayment(): Contract {
    if (this.props.paymentStatus === 'confirmed') return this;
    if (this.props.paymentStatus === 'rejected') {
      throw new DomainError(`Contract ${this.props.id} was rejected and cannot be confirmed without review`);
    }
    return new Contract({ ...this.props, paymentStatus: 'confirmed', paymentUpdatedAt: new Date() });
  }

  rejectPayment(): Contract {
    if (this.props.paymentStatus === 'rejected') return this;
    if (this.props.paymentStatus === 'confirmed') {
      throw new DomainError(`Contract ${this.props.id} is already paid and cannot be rejected`);
    }
    return new Contract({ ...this.props, paymentStatus: 'rejected', paymentUpdatedAt: new Date() });
  }

  toJSON(): ContractProps {
    return { ...this.props };
  }
}
