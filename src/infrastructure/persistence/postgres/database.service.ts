import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { Pool, PoolClient, QueryResultRow } from 'pg';
import { DatabaseConfig } from '../../config/database.config';

@Injectable()
export class DatabaseService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool;

  constructor(config: DatabaseConfig) {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: config.ssl ? { rejectUnauthorized: config.sslRejectUnauthorized } : undefined,
      max: config.poolMax,
      min: config.poolMin,
      idleTimeoutMillis: config.idleTimeoutMs,
      connectionTimeoutMillis: config.connectionTimeoutMs,
      statement_timeout: config.statementTimeoutMs,
      query_timeout: config.statementTimeoutMs,
      application_name: 'hunter-apis',
    });

    this.pool.on('error', (error) => {
      this.logger.error(`Idle connection failed and was discarded: ${error.message}`);
    });
  }

  async onModuleInit(): Promise<void> {
    const { rows } = await this.query<{ version: string }>('SELECT version()');
    this.logger.log(`Connected to ${rows[0]?.version?.split(',')[0] ?? 'PostgreSQL'}`);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
    this.logger.log('Connection pool closed.');
  }

  async query<T extends QueryResultRow>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<{ rows: T[]; rowCount: number }> {
    const result = await this.pool.query<T>(sql, params as unknown[]);
    return { rows: result.rows, rowCount: result.rowCount ?? 0 };
  }

  async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {

      await client.query('ROLLBACK').catch((rollbackError) => {
        this.logger.error(`Rollback failed: ${(rollbackError as Error).message}`);
      });
      throw error;
    } finally {
      client.release();
    }
  }

  stats(): { total: number; idle: number; waiting: number } {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }
}
