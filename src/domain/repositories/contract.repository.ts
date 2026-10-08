import { Contract } from '../entities/contract.entity';

export interface ContractRepository {
  findById(id: string): Promise<Contract | null>;

  create(contract: Contract): Promise<Contract>;

  update(contract: Contract): Promise<Contract>;

  nextSequence(): Promise<number>;

  findByPhone(phone: string, limit?: number): Promise<Contract[]>;
}

export const CONTRACT_REPOSITORY = Symbol('ContractRepository');
