import { Contract } from '../../domain/entities/contract.entity';

export interface DocumentGenerator {
  generateReceipt(contract: Contract): Promise<Buffer>;
}

export const DOCUMENT_GENERATOR = Symbol('DocumentGenerator');
