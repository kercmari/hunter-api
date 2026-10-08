import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseConfig } from '../infrastructure/config/database.config';
import { DatabaseService } from '../infrastructure/persistence/postgres/database.service';
import { PendingContractPostgresAdapter } from '../infrastructure/persistence/postgres/tool-contracts.postgres.adapter';

test('Postgres adapter serializes concurrent retries and rolls back customer + contract', {
  skip: process.env.TEST_POSTGRES !== 'true', timeout: 20000,
}, async () => {
  process.env.DB_POOL_MAX = '2';
  process.env.DB_POOL_MIN = '0';
  const db = new DatabaseService(new DatabaseConfig());
  const adapter = new PendingContractPostgresAdapter(db);
  const marker = `SOLID-${Date.now()}`;
  const phone = '+1999' + Date.now().toString().slice(-8);
  const failurePhone = '+1888' + Date.now().toString().slice(-8);
  const command = { type: 'sale', taxId: marker, productCode: 'SEG03', fullName: 'Prueba SOLID', email: 'solid@example.com', phone, vehicle: { placa: marker } };
  try {
    const contracts = await Promise.all(Array.from({ length: 12 }, () => adapter.getOrCreate(command)));
    assert.equal(new Set(contracts.map(c => c.id)).size, 1);
    assert.deepEqual(contracts[0]!.toJSON().vehicle, command.vehicle);
    const { rows } = await db.query('SELECT id FROM contracts WHERE tax_id=$1', [marker]);
    assert.equal(rows.length, 1);

    const failureDb = Object.create(db) as DatabaseService;
    failureDb.transaction = work => db.transaction(client => {
      const originalQuery = client.query.bind(client);

      const proxy = new Proxy(client, { get(target, key) {
        if (key === 'query') return (sql: string, ...args: unknown[]) => {
          if (sql.includes('INSERT INTO contracts')) throw new Error('Injected contract storage failure');
          return (originalQuery as any)(sql, ...args);
        };
        return Reflect.get(target, key);
      } });
      return work(proxy);
    });
    await assert.rejects(new PendingContractPostgresAdapter(failureDb).getOrCreate({ ...command, taxId: marker + '-FAIL', phone: failurePhone }), /Injected/);
    assert.equal((await db.query('SELECT phone FROM customers WHERE phone=$1', [failurePhone])).rows.length, 0);
    assert.equal((await db.query('SELECT id FROM contracts WHERE tax_id=$1', [marker + '-FAIL'])).rows.length, 0);
  } finally {
    await db.query('DELETE FROM contracts WHERE tax_id = ANY($1::text[])', [[marker, marker + '-FAIL']]);
    await db.query('DELETE FROM customers WHERE phone = ANY($1::text[])', [[phone, failurePhone]]);
    await db.onApplicationShutdown();
  }
});
