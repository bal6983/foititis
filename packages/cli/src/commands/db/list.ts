import type { Command } from 'commander';
import { adminClient } from '../../lib/supabase-admin.js';
import { tables, getTableNames } from '../../lib/table-registry.js';
import { renderTable, error } from '../../lib/display.js';
import ora from 'ora';

export function registerListCommand(parent: Command) {
  parent
    .command('list <table>')
    .description(`List records from a table. Tables: ${getTableNames().join(', ')}`)
    .option('-l, --limit <n>', 'Max rows to return', '25')
    .option('-o, --offset <n>', 'Skip rows', '0')
    .option('--order <col>', 'Order by column (append .desc for descending)', 'created_at.desc')
    .option('--columns <cols>', 'Comma-separated columns to display')
    .action(async (tableName: string, opts: { limit: string; offset: string; order: string; columns?: string }) => {
      const tableDef = tables[tableName];
      if (!tableDef) {
        error(`Unknown table: ${tableName}. Available: ${getTableNames().join(', ')}`);
        return;
      }

      const spinner = ora(`Fetching ${tableName}...`).start();

      const limit = parseInt(opts.limit, 10);
      const offset = parseInt(opts.offset, 10);
      const [orderCol, orderDir] = opts.order.includes('.')
        ? opts.order.split('.')
        : [opts.order, 'asc'];

      const columns = opts.columns
        ? opts.columns.split(',').map((c) => c.trim())
        : tableDef.displayColumns;

      const { data, error: queryError, count } = await adminClient
        .from(tableName)
        .select(columns.join(', '), { count: 'exact' })
        .order(orderCol, { ascending: orderDir !== 'desc' })
        .range(offset, offset + limit - 1);

      spinner.stop();

      if (queryError) {
        error(`Query failed: ${queryError.message}`);
        return;
      }

      console.log(`\n${tableName} (${count ?? '?'} total, showing ${offset + 1}-${offset + (data?.length ?? 0)})\n`);
      console.log(renderTable(columns, data ?? []));
    });
}
