import type { Command } from 'commander';
import { adminClient } from '../../lib/supabase-admin.js';
import { tables, getTableNames } from '../../lib/table-registry.js';
import { renderRecord, error } from '../../lib/display.js';
import ora from 'ora';

export function registerGetCommand(parent: Command) {
  parent
    .command('get <table> <id>')
    .description('Get a single record by ID')
    .option('--raw', 'Output raw JSON')
    .action(async (tableName: string, id: string, opts: { raw?: boolean }) => {
      const tableDef = tables[tableName];
      if (!tableDef) {
        error(`Unknown table: ${tableName}. Available: ${getTableNames().join(', ')}`);
        return;
      }

      const spinner = ora(`Fetching ${tableName}/${id}...`).start();

      const { data, error: queryError } = await adminClient
        .from(tableName)
        .select('*')
        .eq(tableDef.pk, id)
        .maybeSingle();

      spinner.stop();

      if (queryError) {
        error(`Query failed: ${queryError.message}`);
        return;
      }

      if (!data) {
        error(`Record not found: ${tableName}/${id}`);
        return;
      }

      if (opts.raw) {
        console.log(JSON.stringify(data, null, 2));
      } else {
        console.log(`\n${tableName}/${id}\n`);
        console.log(renderRecord(data));
      }
    });
}
