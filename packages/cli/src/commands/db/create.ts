import type { Command } from 'commander';
import inquirer from 'inquirer';
import { adminClient } from '../../lib/supabase-admin.js';
import { tables, getTableNames, getInsertableColumns } from '../../lib/table-registry.js';
import { renderRecord, success, error } from '../../lib/display.js';
import ora from 'ora';

export function registerCreateCommand(parent: Command) {
  parent
    .command('create <table>')
    .description('Create a new record (interactive or JSON)')
    .option('--json <data>', 'JSON data for non-interactive mode')
    .action(async (tableName: string, opts: { json?: string }) => {
      const tableDef = tables[tableName];
      if (!tableDef) {
        error(`Unknown table: ${tableName}. Available: ${getTableNames().join(', ')}`);
        return;
      }

      let record: Record<string, unknown>;

      if (opts.json) {
        try {
          record = JSON.parse(opts.json);
        } catch {
          error('Invalid JSON data');
          return;
        }
      } else {
        const insertable = getInsertableColumns(tableDef);
        const answers: Record<string, unknown> = {};

        for (const col of insertable) {
          const suffix = col.nullable ? ' (optional, press Enter to skip)' : '';
          const { value } = await inquirer.prompt([
            {
              type: 'input',
              name: 'value',
              message: `${col.name} (${col.type})${suffix}:`,
              validate: (input: string) => {
                if (!col.nullable && !input.trim()) return `${col.name} is required`;
                return true;
              },
            },
          ]);

          if (value.trim()) {
            if (col.type === 'boolean') {
              answers[col.name] = value.toLowerCase() === 'true';
            } else if (col.type === 'smallint') {
              answers[col.name] = parseInt(value, 10);
            } else if (col.type === 'text[]') {
              answers[col.name] = value.split(',').map((s: string) => s.trim());
            } else {
              answers[col.name] = value;
            }
          }
        }

        record = answers;
      }

      const spinner = ora('Inserting record...').start();

      const { data, error: insertError } = await adminClient
        .from(tableName)
        .insert(record)
        .select()
        .single();

      spinner.stop();

      if (insertError) {
        error(`Insert failed: ${insertError.message}`);
        return;
      }

      success(`Record created in ${tableName}`);
      console.log(renderRecord(data));
    });
}
