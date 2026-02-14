import type { Command } from 'commander';
import inquirer from 'inquirer';
import { adminClient } from '../../lib/supabase-admin.js';
import { tables, getTableNames } from '../../lib/table-registry.js';
import { renderRecord, success, error } from '../../lib/display.js';
import ora from 'ora';

export function registerUpdateCommand(parent: Command) {
  parent
    .command('update <table> <id>')
    .description('Update a record (interactive or JSON)')
    .option('--json <data>', 'JSON data for non-interactive mode')
    .action(async (tableName: string, id: string, opts: { json?: string }) => {
      const tableDef = tables[tableName];
      if (!tableDef) {
        error(`Unknown table: ${tableName}. Available: ${getTableNames().join(', ')}`);
        return;
      }

      // Fetch current record
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

      let updates: Record<string, unknown>;

      if (opts.json) {
        try {
          updates = JSON.parse(opts.json);
        } catch {
          error('Invalid JSON data');
          return;
        }
      } else {
        console.log('\nCurrent values:');
        console.log(renderRecord(current));
        console.log('\nEnter new values (press Enter to keep current):\n');

        const editableColumns = tableDef.columns.filter(
          (col) => col.name !== tableDef.pk && col.name !== 'created_at' && col.name !== 'updated_at'
        );

        updates = {};

        for (const col of editableColumns) {
          const currentVal = current[col.name];
          const { value } = await inquirer.prompt([
            {
              type: 'input',
              name: 'value',
              message: `${col.name} [${currentVal ?? 'null'}]:`,
            },
          ]);

          if (value.trim()) {
            if (col.type === 'boolean') {
              updates[col.name] = value.toLowerCase() === 'true';
            } else if (col.type === 'smallint') {
              updates[col.name] = parseInt(value, 10);
            } else if (col.type === 'text[]') {
              updates[col.name] = value.split(',').map((s: string) => s.trim());
            } else {
              updates[col.name] = value;
            }
          }
        }

        if (Object.keys(updates).length === 0) {
          error('No changes made');
          return;
        }
      }

      const spinner = ora('Updating record...').start();

      const { data, error: updateError } = await adminClient
        .from(tableName)
        .update(updates)
        .eq(tableDef.pk, id)
        .select()
        .single();

      spinner.stop();

      if (updateError) {
        error(`Update failed: ${updateError.message}`);
        return;
      }

      success(`Record updated in ${tableName}`);
      console.log(renderRecord(data));
    });
}
