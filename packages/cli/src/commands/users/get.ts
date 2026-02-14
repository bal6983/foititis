import type { Command } from 'commander';
import { adminClient } from '../../lib/supabase-admin.js';
import { renderRecord, error, info } from '../../lib/display.js';
import ora from 'ora';

export function registerUsersGetCommand(parent: Command) {
  parent
    .command('get <id>')
    .description('Get a user by ID (auth + profile)')
    .action(async (id: string) => {
      const spinner = ora('Fetching user...').start();

      const { data: authData, error: authError } = await adminClient.auth.admin.getUserById(id);

      if (authError) {
        spinner.stop();
        error(`Auth user not found: ${authError.message}`);
        return;
      }

      const { data: profile } = await adminClient
        .from('profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      spinner.stop();

      const user = authData.user;
      console.log('\n--- Auth User ---');
      console.log(
        renderRecord({
          id: user.id,
          email: user.email ?? '',
          phone: user.phone ?? '',
          email_confirmed: user.email_confirmed_at ? 'yes' : 'no',
          created_at: user.created_at,
          last_sign_in: user.last_sign_in_at ?? 'never',
          role: user.role ?? '',
          app_metadata: JSON.stringify(user.app_metadata),
          user_metadata: JSON.stringify(user.user_metadata),
        })
      );

      if (profile) {
        console.log('\n--- Profile ---');
        console.log(renderRecord(profile));
      } else {
        info('No profile record found for this user');
      }
    });
}
