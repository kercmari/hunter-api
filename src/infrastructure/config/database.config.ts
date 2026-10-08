import { Injectable } from '@nestjs/common';

function integer(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max} (received: ${raw})`);
  }
  return value;
}

function required(name: string): string {
  const value = (process.env[name] ?? '').trim();
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

@Injectable()
export class DatabaseConfig {
  readonly host = required('DB_HOST');
  readonly port = integer('DB_PORT', 5432, 1, 65535);
  readonly user = required('DB_USER');
  readonly password = required('DB_PASSWORD');
  readonly database = required('DB_NAME');

  readonly ssl = (process.env.DB_SSL ?? 'false').toLowerCase() === 'true';

  readonly sslRejectUnauthorized =
    (process.env.DB_SSL_REJECT_UNAUTHORIZED ?? 'true').toLowerCase() !== 'false';

  readonly poolMax = integer('DB_POOL_MAX', 10, 1, 100);
  readonly poolMin = integer('DB_POOL_MIN', 0, 0, 20);

  readonly idleTimeoutMs = integer('DB_IDLE_TIMEOUT_MS', 30_000, 1_000, 600_000);
  readonly connectionTimeoutMs = integer('DB_CONNECTION_TIMEOUT_MS', 5_000, 500, 60_000);
  readonly statementTimeoutMs = integer('DB_STATEMENT_TIMEOUT_MS', 15_000, 1_000, 120_000);

  constructor() {
    if (this.poolMin > this.poolMax) {
      throw new Error('DB_POOL_MIN cannot exceed DB_POOL_MAX');
    }

    const trustedNetwork = (process.env.DB_TRUSTED_NETWORK ?? 'false').toLowerCase() === 'true';
    if (process.env.NODE_ENV === 'production' && !this.ssl && !trustedNetwork) {
      throw new Error(
        'DB_SSL must be enabled in production, or set DB_TRUSTED_NETWORK=true ' +
          'when the database is only reachable over a private network',
      );
    }
  }
}
