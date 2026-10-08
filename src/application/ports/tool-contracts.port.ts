import { Contract } from '../../domain/entities/contract.entity';
import { CreateContractCommand } from '../dto/create-contract.command';

export interface ContractedProduct { fullName: string; productCode: string; }
export interface ContractSearchPort {
  findServices(taxId: string, plate: string): Promise<ContractedProduct[]>;
  findPendingIds(taxId: string, productCode: string): Promise<string[]>;
}
export const CONTRACT_SEARCH = Symbol('ContractSearch');

export interface PendingContractPort {
  getOrCreate(command: CreateContractCommand): Promise<Contract>;
}
export const PENDING_CONTRACT = Symbol('PendingContract');
