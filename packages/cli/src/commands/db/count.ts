import type { Command } from 'commander';
import { adminClient } from '../../lib/supabase-admin.js';
import { tables, getTableNames } from '../../lib/table-registry.js';
import { error, info } from '../../lib/display.js';
import ora from 'ora';

export function registerCountCommand(parent: Command) {
  parent
    .command('count <table>')
    .description('Count records in a table')
    .option('--where <filter>', 'Filter as column=value')
    .action(async (tableName: string, opts: { where?: string }) => {
      const tableDef = tables[tableName];
      if (!tableDef) {
        error(`Unknown table: ${tableName}. Available: ${getTableNames().join(', ')}`);
        return;
      }

      const spinner = ora(`Counting ${tableName}...`).start();

      let query = adminClient
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (opts.where) {
        const [col, val] = opts.where.split('=');
        if (col && val) {
          if (val === 'true' || val === 'false') {
            query = query.eq(col.trim(), val === 'true');
          } else {
            query = query.eq(col.trim(), val.trim());
          }
        }
      }

      const { count, error: queryError } = await query;

      spinner.stop();

      if (queryError) {
        error(`Count failed: ${queryError.message}`);
        return;
      }

      const filterInfo = opts.where ? ` (where ${opts.where})` : '';
      info(`${tableName}${filterInfo}: ${count ?? 0} records`);
    });
}
