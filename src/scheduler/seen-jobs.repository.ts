import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

@Injectable()
export class SeenJobsRepository implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SeenJobsRepository.name);
  private readonly pool: Pool;

  constructor(private readonly configService: ConfigService) {
    this.pool = new Pool({ connectionString: this.configService.get<string>('DATABASE_URL') });
  }

  async onModuleInit() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS seen_jobs (
        id TEXT PRIMARY KEY,
        seen_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async loadAll(): Promise<Set<string>> {
    const { rows } = await this.pool.query<{ id: string }>('SELECT id FROM seen_jobs');
    return new Set(rows.map((r) => r.id));
  }

  async saveMany(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const values = ids.map((_, i) => `($${i + 1})`).join(',');
    await this.pool.query(
      `INSERT INTO seen_jobs (id) VALUES ${values} ON CONFLICT DO NOTHING`,
      ids,
    );
  }
}
