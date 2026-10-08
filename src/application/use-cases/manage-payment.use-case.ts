import { Inject, Injectable, Logger } from '@nestjs/common';
import { Contract, PaymentStatus } from '../../domain/entities/contract.entity';
import { NotFoundError } from '../../domain/errors/domain.error';
import { CONTRACT_REPOSITORY, ContractRepository } from '../../domain/repositories/contract.repository';

export interface PaymentResult {
  readonly contractId: string;
  readonly status: PaymentStatus;

  readonly unchanged: boolean;
  readonly updatedAt?: Date;
}

@Injectable()
export class ManagePaymentUseCase {
  private readonly logger = new Logger(ManagePaymentUseCase.name);

  constructor(
    @Inject(CONTRACT_REPOSITORY) private readonly contracts: ContractRepository,
  ) {}

  async confirm(contractId: string): Promise<PaymentResult> {
    const contract = await this.load(contractId);
    if (contract.paymentStatus === 'confirmed') return this.result(contract, true);

    const updated = await this.contracts.update(contract.confirmPayment());
    this.logger.log(`Payment confirmed: ${updated.id}`);
    return this.result(updated, false);
  }

  async reject(contractId: string): Promise<PaymentResult> {
    const contract = await this.load(contractId);
    if (contract.paymentStatus === 'rejected') return this.result(contract, true);

    const updated = await this.contracts.update(contract.rejectPayment());
    this.logger.warn(`Payment rejected: ${updated.id}`);
    return this.result(updated, false);
  }

  async status(contractId: string): Promise<PaymentResult> {
    const contract = await this.load(contractId);
    return this.result(contract, true);
  }

  private async load(contractId: string): Promise<Contract> {
    const contract = await this.contracts.findById(contractId);
    if (!contract) throw new NotFoundError('Contract', contractId);
    return contract;
  }

  private result(contract: Contract, unchanged: boolean): PaymentResult {
    return {
      contractId: contract.id,
      status: contract.paymentStatus,
      unchanged,
      updatedAt: contract.paymentUpdatedAt,
    };
  }
}
