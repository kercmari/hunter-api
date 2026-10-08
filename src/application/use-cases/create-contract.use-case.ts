import { Inject, Injectable, Logger } from '@nestjs/common';
import { Contract, ContractType } from '../../domain/entities/contract.entity';
import { Customer } from '../../domain/entities/customer.entity';
import { calculatePrice, findProduct } from '../../domain/entities/product.entity';
import { NotFoundError } from '../../domain/errors/domain.error';
import { CONTRACT_REPOSITORY, ContractRepository } from '../../domain/repositories/contract.repository';
import { CUSTOMER_REPOSITORY, CustomerRepository } from '../../domain/repositories/customer.repository';
import { CreateContractCommand } from '../dto/create-contract.command';

@Injectable()
export class CreateContractUseCase {
  private readonly logger = new Logger(CreateContractUseCase.name);

  constructor(
    @Inject(CONTRACT_REPOSITORY) private readonly contracts: ContractRepository,
    @Inject(CUSTOMER_REPOSITORY) private readonly customers: CustomerRepository,
  ) {}

  async execute(command: CreateContractCommand): Promise<Contract> {
    const product = findProduct(command.productCode);
    if (!product) throw new NotFoundError('Product', command.productCode);

    const { total } = calculatePrice(product);

    const existing = await this.customers.findByPhone(command.phone);
    const customer = existing
      ? existing.mergeWith({
          fullName: command.fullName,
          taxId: command.taxId,
          email: command.email,
        })
      : Customer.create({
          phone: command.phone,
          fullName: command.fullName,
          taxId: command.taxId,
          email: command.email,
        });
    await this.customers.save(customer);

    const sequence = await this.contracts.nextSequence();
    const id = `CT-${String(sequence).padStart(6, '0')}`;

    const contract = Contract.create({
      id,
      type: command.type as ContractType,
      amount: total,
      taxId: command.taxId,
      productCode: product.code,
      fullName: command.fullName,
      email: command.email,
      phone: command.phone,
      vehicle: command.vehicle,
    });

    const saved = await this.contracts.create(contract);
    this.logger.log(`Contract ${saved.id} created (${product.code}).`);
    return saved;
  }
}
