import type { Command } from 'commander';
import inquirer from 'inquirer';
import { adminClient } from '../../lib/supabase-admin.js';
import { renderRecord, success, error } from '../../lib/display.js';
import ora from 'ora';

export function registerUsersDeleteCommand(parent: Command) {
  parent
    .command('delete <id>')
    .description('Delete a user (auth + profile cascade)')
    .option('-f, --force', 'Skip confirmation')
    .action(async (id: string, opts: { force?: boolean }) => {
      // Fetch user info first
      const { data: authData, error: authError } = await adminClient.auth.admin.getUserById(id);

      if (authError) {
        error(`User not found: ${authError.message}`);
        return;
      }

      const { data: profile } = await adminClient
        .from('profiles')
        .select('id, display_name, email, is_pre_student, is_verified_student')
        .eq('id', id)
        .maybeSingle();

      if (!opts.force) {
        console.log('\nUser to delete:');
        console.log(
          renderRecord({
            id: authData.user.id,
            email: authData.user.email ?? '',
            display_name: profile?.display_name ?? '-',
            is_pre_student: profile?.is_pre_student ?? '-',
            is_verified_student: profile?.is_verified_student ?? '-',
          })
        );

        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Delete this user? This will cascade-delete their profile and related data.',
            default: false,
          },
        ]);

        if (!confirm) {
          error('Cancelled');
          return;
        }
      }

      const spinner = ora('Deleting user...').start();

      // Delete profile first (in case cascade doesn't work)
      if (profile) {
        await adminClient.from('profiles').delete().eq('id', id);
      }

      const { error: deleteError } = await adminClient.auth.admin.deleteUser(id);

      spinner.stop();

      if (deleteError) {
        error(`Delete failed: ${deleteError.message}`);
        return;
      }

      success(`User ${authData.user.email ?? id} deleted`);
    });
}
