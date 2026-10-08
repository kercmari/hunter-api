import { Inject, Injectable } from '@nestjs/common';
import { Contract } from '../../domain/entities/contract.entity';
import { findProduct } from '../../domain/entities/product.entity';
import { NotFoundError } from '../../domain/errors/domain.error';
import { CONTRACT_REPOSITORY, ContractRepository } from '../../domain/repositories/contract.repository';
import { CUSTOMER_REPOSITORY, CustomerRepository } from '../../domain/repositories/customer.repository';

export interface ContractedService {
  readonly contractId: string;
  readonly productCode: string;
  readonly productName: string;
  readonly amount: number;
  readonly paymentStatus: string;
  readonly contractedAt: Date;
}

export interface CustomerServices {
  readonly phone: string;
  readonly fullName?: string;
  readonly services: readonly ContractedService[];
}

@Injectable()
export class ListCustomerServicesUseCase {
  constructor(
    @Inject(CONTRACT_REPOSITORY) private readonly contracts: ContractRepository,
    @Inject(CUSTOMER_REPOSITORY) private readonly customers: CustomerRepository,
  ) {}

  async execute(phone: string): Promise<CustomerServices> {
    const customer = await this.customers.findByPhone(phone);
    if (!customer) throw new NotFoundError('Customer', phone);

    const contracts = await this.contracts.findByPhone(phone, 50);
    return {
      phone: customer.phone,
      fullName: customer.fullName,
      services: contracts.map((contract) => this.toService(contract)),
    };
  }

  private toService(contract: Contract): ContractedService {
    const product = findProduct(contract.productCode);
    return {
      contractId: contract.id,
      productCode: contract.productCode,
      productName: product?.name ?? contract.productCode,
      amount: contract.amount,
      paymentStatus: contract.paymentStatus,
      contractedAt: contract.createdAt,
    };
  }
}
