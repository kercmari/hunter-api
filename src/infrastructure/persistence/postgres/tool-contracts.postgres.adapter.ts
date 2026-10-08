import { Injectable } from '@nestjs/common';
import { ContractSearchPort, PendingContractPort } from '../../../application/ports/tool-contracts.port';
import { CreateContractCommand } from '../../../application/dto/create-contract.command';
import { CreateContractUseCase } from '../../../application/use-cases/create-contract.use-case';
import { DatabaseService } from './database.service';
import { ContractPostgresRepository } from './contract.postgres.repository';
import { CustomerPostgresRepository } from './customer.postgres.repository';

@Injectable()
export class ContractSearchPostgresAdapter implements ContractSearchPort {
  constructor(private readonly db: DatabaseService) {}
  async findServices(taxId: string, plate: string) {
    const { rows } = await this.db.query<{ full_name: string; product_code: string }>(
      `SELECT DISTINCT full_name, product_code FROM contracts
       WHERE tax_id = $1 AND upper(vehicle->>'placa') = upper($2)`, [taxId.trim(), plate.trim()]);
    return rows.map(row => ({ fullName: row.full_name, productCode: row.product_code }));
  }
  async findPendingIds(taxId: string, productCode: string) {
    const { rows } = await this.db.query<{ id: string }>(
      `SELECT id FROM contracts WHERE tax_id=$1 AND product_code=$2 AND payment_status='pending'`,
      [taxId.trim(), productCode.trim().toUpperCase()]);
    return rows.map(row => row.id);
  }
}

@Injectable()
export class PendingContractPostgresAdapter implements PendingContractPort {
  constructor(private readonly db: DatabaseService) {}
  getOrCreate(command: CreateContractCommand) {
    return this.db.transaction(async client => {
      const taxId = command.taxId.trim();
      const productCode = command.productCode.trim().toUpperCase();
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${taxId}|${productCode}|${command.type}`]);
      const { rows } = await client.query<{ id: string }>(
        `SELECT id FROM contracts WHERE tax_id=$1 AND product_code=$2 AND type=$3
         AND payment_status='pending' ORDER BY created_at DESC LIMIT 1`, [taxId, productCode, command.type]);
      // Reutilizar la conexión evita agotar el pool mientras se mantiene el bloqueo.

      const executor = { query: async (sql: string, params: readonly unknown[] = []) => {
        const result = await client.query(sql, [...params]);
        return { rows: result.rows, rowCount: result.rowCount ?? 0 };
      } };
      const contracts = new ContractPostgresRepository(executor);
      if (rows[0]) return (await contracts.findById(rows[0].id))!;
      const customers = new CustomerPostgresRepository(executor);
      return new CreateContractUseCase(contracts, customers).execute({ ...command, taxId, productCode });
    });
  }
}
