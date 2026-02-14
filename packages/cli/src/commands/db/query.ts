import type { Command } from 'commander';
import { adminClient } from '../../lib/supabase-admin.js';
import { tables, getTableNames } from '../../lib/table-registry.js';
import { renderTable, error } from '../../lib/display.js';
import ora from 'ora';

export function registerQueryCommand(parent: Command) {
  parent
    .command('query <table>')
    .description('Query a table with filters')
    .option('--where <filters>', 'Filters as col=val (comma-separated for multiple)')
    .option('--ilike <filter>', 'Case-insensitive pattern match as col=%pattern%')
    .option('-l, --limit <n>', 'Max rows', '25')
    .option('--order <col>', 'Order by column (append .desc for descending)')
    .option('--columns <cols>', 'Comma-separated columns')
    .action(
      async (
        tableName: string,
        opts: { where?: string; ilike?: string; limit: string; order?: string; columns?: string }
      ) => {
        const tableDef = tables[tableName];
        if (!tableDef) {
          error(`Unknown table: ${tableName}. Available: ${getTableNames().join(', ')}`);
          return;
        }

        const columns = opts.columns
          ? opts.columns.split(',').map((c) => c.trim())
          : tableDef.displayColumns;

        const spinner = ora(`Querying ${tableName}...`).start();

        let query = adminClient
          .from(tableName)
          .select(columns.join(', '), { count: 'exact' })
          .limit(parseInt(opts.limit, 10));

        // Apply equality filters
        if (opts.where) {
          for (const filter of opts.where.split(',')) {
            const [col, val] = filter.split('=');
            if (col && val) {
              if (val === 'true' || val === 'false') {
                query = query.eq(col.trim(), val === 'true');
              } else {
                query = query.eq(col.trim(), val.trim());
              }
            }
          }
        }

        // Apply ilike filter
        if (opts.ilike) {
          const [col, pattern] = opts.ilike.split('=');
          if (col && pattern) {
            query = query.ilike(col.trim(), pattern.trim());
          }
        }

        // Apply ordering
        if (opts.order) {
          const [orderCol, orderDir] = opts.order.includes('.')
            ? opts.order.split('.')
            : [opts.order, 'asc'];
          query = query.order(orderCol, { ascending: orderDir !== 'desc' });
        }

        const { data, error: queryError, count } = await query;

        spinner.stop();

        if (queryError) {
          error(`Query failed: ${queryError.message}`);
          return;
        }

        console.log(`\n${tableName} (${count ?? '?'} matched, showing ${data?.length ?? 0})\n`);
        console.log(renderTable(columns, data ?? []));
      }
    );
}
