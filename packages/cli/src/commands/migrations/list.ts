import type { Command } from 'commander';
import { readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderTable, error, info } from '../../lib/display.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getMigrationsDir(): string {
  return resolve(__dirname, '../../../../../supabase/migrations');
}

export function registerMigrationsListCommand(parent: Command) {
  parent
    .command('list')
    .description('List all migration files')
    .action(() => {
      const migrationsDir = getMigrationsDir();

      let files: string[];
      try {
        files = readdirSync(migrationsDir)
          .filter((f) => f.endsWith('.sql'))
          .sort();
      } catch {
        error(`Migrations directory not found: ${migrationsDir}`);
        return;
      }

      if (files.length === 0) {
        info('No migrations found');
        return;
      }

      const rows = files.map((filename) => {
        const match = filename.match(/^(\d{14})_(.+)\.sql$/);
        const timestamp = match?.[1] ?? 'unknown';
        const name = match?.[2]?.replace(/_/g, ' ') ?? filename;
        const formatted = timestamp.replace(
          /(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/,
          '$1-$2-$3 $4:$5:$6'
        );
        return { timestamp: formatted, name, filename };
      });

      console.log(`\nMigrations (${files.length} total)\n`);
      console.log(renderTable(['timestamp', 'name', 'filename'], rows));
    });
}
