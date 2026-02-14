import type { Command } from 'commander';
import inquirer from 'inquirer';
import { adminClient } from '../../lib/supabase-admin.js';
import { tables, getTableNames } from '../../lib/table-registry.js';
import { renderRecord, success, error } from '../../lib/display.js';
import ora from 'ora';

export function registerDeleteCommand(parent: Command) {
  parent
    .command('delete <table> <id>')
    .description('Delete a record by ID')
    .option('-f, --force', 'Skip confirmation')
    .action(async (tableName: string, id: string, opts: { force?: boolean }) => {
      const tableDef = tables[tableName];
      if (!tableDef) {
        error(`Unknown table: ${tableName}. Available: ${getTableNames().join(', ')}`);
        return;
      }

      // Fetch to show what will be deleted
      const { data: current, error: fetchError } = await adminClient
        .from(tableName)
        .select('*')
        .eq(tableDef.pk, id)
        .maybeSingle();

      if (fetchError) {
        error(`Fetch failed: ${fetchError.message}`);
        return;
      }
      if (!current) {
        error(`Record not found: ${tableName}/${id}`);
        return;
      }

      if (!opts.force) {
        console.log('\nRecord to delete:');
        console.log(renderRecord(current));

        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Delete this record from ${tableName}?`,
            default: false,
          },
        ]);

        if (!confirm) {
          error('Cancelled');
          return;
        }
      }

      const spinner = ora('Deleting record...').start();

      const { error: deleteError } = await adminClient
        .from(tableName)
        .delete()
        .eq(tableDef.pk, id);

      spinner.stop();

      if (deleteError) {
        error(`Delete failed: ${deleteError.message}`);
        return;
      }

      success(`Deleted ${tableName}/${id}`);
    });
}
