import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/persistence/postgres/database.service';

@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  async status() {
    try {
      await this.db.query('SELECT 1');
      return { status: 'ok', database: 'ok', pool: this.db.stats() };
    } catch {
      return { status: 'degraded', database: 'error' };
    }
  }
}
