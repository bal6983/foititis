import type { Command } from 'commander';
import { createClient } from '@supabase/supabase-js';
import inquirer from 'inquirer';
import { adminClient } from '../../lib/supabase-admin.js';
import { getConfig, getAnonKey } from '../../lib/config.js';
import { tables, getTableNames } from '../../lib/table-registry.js';
import { renderTable, success, error, info, warn } from '../../lib/display.js';
import ora from 'ora';
import chalk from 'chalk';

const OPERATIONS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] as const;
type Operation = (typeof OPERATIONS)[number];

export function registerRlsTestCommand(parent: Command) {
  parent
    .command('test <table>')
    .description('Test RLS policies on a table as different roles')
    .option('--as <role>', 'Role: anon, authenticated, service_role')
    .option('--user <id>', 'User ID (for authenticated role)')
    .action(async (tableName: string, opts: { as?: string; user?: string }) => {
      const tableDef = tables[tableName];
      if (!tableDef) {
        error(`Unknown table: ${tableName}. Available: ${getTableNames().join(', ')}`);
        return;
      }

      let role = opts.as;
      let userId = opts.user;

      if (!role) {
        const answer = await inquirer.prompt([
          {
            type: 'list',
            name: 'role',
            message: 'Test as which role?',
            choices: [
              { name: 'anon (no authentication)', value: 'anon' },
              { name: 'authenticated (sign in as user)', value: 'authenticated' },
              { name: 'service_role (admin bypass)', value: 'service_role' },
            ],
          },
        ]);
        role = answer.role;
      }

      if (role === 'authenticated' && !userId) {
        const answer = await inquirer.prompt([
          { type: 'input', name: 'userId', message: 'User ID:' },
        ]);
        userId = answer.userId;
      }

      console.log(`\nTesting RLS on ${chalk.cyan(tableName)} as ${chalk.yellow(role!)}\n`);

      const results: { operation: string; status: string; detail: string }[] = [];

      for (const op of OPERATIONS) {
        const spinner = ora(`Testing ${op}...`).start();
        const result = await testOperation(tableName, tableDef.pk, op, role!, userId);
        spinner.stop();
        results.push(result);

        const icon = result.status === 'ALLOWED' ? chalk.green('ALLOWED') : chalk.red('DENIED');
        console.log(`  ${op}: ${icon} - ${result.detail}`);
      }

      console.log('');
      info(`RLS test complete for ${tableName} as ${role}`);
    });
}

async function testOperation(
  tableName: string,
  pk: string,
  operation: Operation,
  role: string,
  userId?: string
): Promise<{ operation: string; status: string; detail: string }> {
  try {
    const client = await getClientForRole(role, userId);

    switch (operation) {
      case 'SELECT': {
        const { data, error: queryError } = await client.from(tableName).select('*').limit(1);
        if (queryError) return { operation, status: 'DENIED', detail: queryError.message };
        return { operation, status: 'ALLOWED', detail: `${data?.length ?? 0} rows returned` };
      }
      case 'INSERT': {
        // Try inserting a dummy record, then abort via a definitely-wrong FK
        const { error: insertError } = await client
          .from(tableName)
          .insert({ [pk]: '00000000-0000-0000-0000-000000000000' });
        if (insertError) {
          if (insertError.message.includes('row-level security') || insertError.code === '42501') {
            return { operation, status: 'DENIED', detail: 'RLS policy blocked insert' };
          }
          // Other errors (FK violation, etc.) mean RLS allowed the attempt
          return { operation, status: 'ALLOWED', detail: `Reached DB (${insertError.message})` };
        }
        // Clean up the test record
        await adminClient.from(tableName).delete().eq(pk, '00000000-0000-0000-0000-000000000000');
        return { operation, status: 'ALLOWED', detail: 'Insert succeeded (cleaned up)' };
      }
      case 'UPDATE': {
        const { error: updateError } = await client
          .from(tableName)
          .update({ updated_at: new Date().toISOString() })
          .eq(pk, '00000000-0000-0000-0000-000000000000');
        if (updateError) {
          if (updateError.message.includes('row-level security') || updateError.code === '42501') {
            return { operation, status: 'DENIED', detail: 'RLS policy blocked update' };
          }
          return { operation, status: 'ALLOWED', detail: `Reached DB (${updateError.message})` };
        }
        return { operation, status: 'ALLOWED', detail: '0 rows affected (no matching record)' };
      }
      case 'DELETE': {
        const { error: deleteError } = await client
          .from(tableName)
          .delete()
          .eq(pk, '00000000-0000-0000-0000-000000000000');
        if (deleteError) {
          if (deleteError.message.includes('row-level security') || deleteError.code === '42501') {
            return { operation, status: 'DENIED', detail: 'RLS policy blocked delete' };
          }
          return { operation, status: 'ALLOWED', detail: `Reached DB (${deleteError.message})` };
        }
        return { operation, status: 'ALLOWED', detail: '0 rows affected (no matching record)' };
      }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { operation, status: 'ERROR', detail: msg };
  }
}

async function getClientForRole(role: string, userId?: string) {
  const { supabaseUrl } = getConfig();

  if (role === 'service_role') {
    return adminClient;
  }

  if (role === 'anon') {
    const anonKey = getAnonKey();
    return createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  if (role === 'authenticated' && userId) {
    const anonKey = getAnonKey();

    // Generate a magic link to get a valid session token for this user
    const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(userId);
    if (userError || !userData.user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Use generateLink to get an action link, then extract the token
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: userData.user.email!,
    });

    if (linkError || !linkData) {
      throw new Error(`Failed to generate auth link: ${linkError?.message}`);
    }

    // Create a client and set the auth token
    const client = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify the token from the magic link if available
    if (linkData.properties?.hashed_token) {
      // Use the admin-generated session approach instead
      const { data: sessionData, error: sessionError } = await client.auth.verifyOtp({
        token_hash: linkData.properties.hashed_token,
        type: 'magiclink',
      });

      if (sessionError) {
        warn(`Could not create authenticated session: ${sessionError.message}`);
        warn('Falling back to anon client for this test');
        return client;
      }
    }

    return client;
  }

  throw new Error(`Unknown role: ${role}`);
}
