import type { Command } from 'commander';
import inquirer from 'inquirer';
import { adminClient } from '../../lib/supabase-admin.js';
import { renderTable, renderRecord, success, error } from '../../lib/display.js';
import ora from 'ora';

const LOOKUP_TABLES = ['cities', 'universities', 'schools', 'categories', 'locations'] as const;

type LookupTable = (typeof LOOKUP_TABLES)[number];

const FK_FIELDS: Partial<Record<LookupTable, { label: string; fkColumn: string; fkTable: LookupTable }>> = {
  universities: { label: 'City', fkColumn: 'city_id', fkTable: 'cities' },
  schools: { label: 'University', fkColumn: 'university_id', fkTable: 'universities' },
};

export function registerSeedLookupCommand(parent: Command) {
  parent
    .command('lookup')
    .description('Manage lookup tables (cities, universities, schools, categories, locations)')
    .action(async () => {
      const { table } = await inquirer.prompt([
        {
          type: 'list',
          name: 'table',
          message: 'Which lookup table?',
          choices: [...LOOKUP_TABLES],
        },
      ]);

      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'Action:',
          choices: ['List all', 'Add new', 'Delete by ID'],
        },
      ]);

      if (action === 'List all') {
        await listLookup(table);
      } else if (action === 'Add new') {
        await addLookup(table);
      } else {
        await deleteLookup(table);
      }
    });
}

async function listLookup(table: LookupTable) {
  const spinner = ora(`Fetching ${table}...`).start();

  const { data, error: queryError } = await adminClient
    .from(table)
    .select('*')
    .order('name');

  spinner.stop();

  if (queryError) {
    error(`Query failed: ${queryError.message}`);
    return;
  }

  if (!data?.length) {
    console.log(`\nNo records in ${table}`);
    return;
  }

  const columns = Object.keys(data[0]);
  console.log(`\n${table} (${data.length} records)\n`);
  console.log(renderTable(columns, data));
}

async function addLookup(table: LookupTable) {
  const record: Record<string, unknown> = {};

  const { name } = await inquirer.prompt([
    { type: 'input', name: 'name', message: 'Name:', validate: (v: string) => !!v.trim() || 'Required' },
  ]);
  record.name = name;

  // Handle FK fields
  const fkInfo = FK_FIELDS[table];
  if (fkInfo) {
    const spinner = ora(`Loading ${fkInfo.fkTable}...`).start();
    const { data: fkData } = await adminClient.from(fkInfo.fkTable).select('id, name').order('name');
    spinner.stop();

    if (fkData?.length) {
      const { fkId } = await inquirer.prompt([
        {
          type: 'list',
          name: 'fkId',
          message: `${fkInfo.label}:`,
          choices: fkData.map((r) => ({ name: r.name, value: r.id })),
        },
      ]);
      record[fkInfo.fkColumn] = fkId;
    }
  }

  // Special fields
  if (table === 'universities') {
    const { domains } = await inquirer.prompt([
      {
        type: 'input',
        name: 'domains',
        message: 'Email domains (comma-separated, e.g. ntua.gr,mail.ntua.gr):',
      },
    ]);
    if (domains.trim()) {
      record.email_domains = domains.split(',').map((d: string) => d.trim());
    }
  }

  const spinner = ora('Inserting...').start();
  const { data, error: insertError } = await adminClient.from(table).insert(record).select().single();
  spinner.stop();

  if (insertError) {
    error(`Insert failed: ${insertError.message}`);
    return;
  }

  success(`Added to ${table}`);
  console.log(renderRecord(data));
}

async function deleteLookup(table: LookupTable) {
  const { id } = await inquirer.prompt([
    { type: 'input', name: 'id', message: 'ID to delete:', validate: (v: string) => !!v.trim() || 'Required' },
  ]);

  const { data: current } = await adminClient.from(table).select('*').eq('id', id).maybeSingle();

  if (!current) {
    error(`Record not found: ${table}/${id}`);
    return;
  }

  console.log('\nRecord to delete:');
  console.log(renderRecord(current));

  const { confirm } = await inquirer.prompt([
    { type: 'confirm', name: 'confirm', message: 'Delete?', default: false },
  ]);

  if (!confirm) {
    error('Cancelled');
    return;
  }

  const spinner = ora('Deleting...').start();
  const { error: deleteError } = await adminClient.from(table).delete().eq('id', id);
  spinner.stop();

  if (deleteError) {
    error(`Delete failed: ${deleteError.message}`);
    return;
  }

  success(`Deleted from ${table}`);
}
