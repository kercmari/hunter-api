import { Customer } from '../entities/customer.entity';

export interface CustomerRepository {
  findByPhone(phone: string): Promise<Customer | null>;
  findByTaxId(taxId: string): Promise<Customer | null>;

  save(customer: Customer): Promise<Customer>;
}

export const CUSTOMER_REPOSITORY = Symbol('CustomerRepository');
