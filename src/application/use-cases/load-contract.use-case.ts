import { Inject, Injectable } from '@nestjs/common';
import { CONTRACT_REPOSITORY, ContractRepository } from '../../domain/repositories/contract.repository';
import { NotFoundError } from '../../domain/errors/domain.error';

@Injectable()
export class LoadContractUseCase {
  constructor(@Inject(CONTRACT_REPOSITORY) private readonly contracts: ContractRepository) {}
  async execute(id: string) {
    const contract = await this.contracts.findById(id);
    if (!contract) throw new NotFoundError('Contrato', id);
    return contract;
  }
}
