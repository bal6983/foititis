import type { Command } from 'commander';
import { adminClient } from '../../lib/supabase-admin.js';
import { renderTable, error } from '../../lib/display.js';
import ora from 'ora';

export function registerUsersListCommand(parent: Command) {
  parent
    .command('list')
    .description('List auth users with profile info')
    .option('-p, --page <n>', 'Page number', '1')
    .option('--per-page <n>', 'Users per page', '25')
    .action(async (opts: { page: string; perPage: string }) => {
      const spinner = ora('Fetching users...').start();

      const page = parseInt(opts.page, 10);
      const perPage = parseInt(opts.perPage, 10);

      const { data, error: listError } = await adminClient.auth.admin.listUsers({
        page,
        perPage,
      });

      if (listError) {
        spinner.stop();
        error(`Failed to list users: ${listError.message}`);
        return;
      }

      // Fetch profiles for these users
      const userIds = data.users.map((u) => u.id);
      const { data: profiles } = await adminClient
        .from('profiles')
        .select('id, display_name, is_verified_student, is_pre_student')
        .in('id', userIds);

      spinner.stop();

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);

      const rows = data.users.map((u) => {
        const p = profileMap.get(u.id);
        return {
          id: u.id,
          email: u.email ?? '',
          display_name: p?.display_name ?? '-',
          verified: p?.is_verified_student ?? false,
          pre_student: p?.is_pre_student ?? false,
          created: u.created_at ? new Date(u.created_at).toLocaleDateString() : '-',
          last_sign_in: u.last_sign_in_at
            ? new Date(u.last_sign_in_at).toLocaleDateString()
            : 'never',
        };
      });

      console.log(`\nUsers (page ${page}, ${data.users.length} shown)\n`);
      console.log(
        renderTable(
          ['id', 'email', 'display_name', 'verified', 'pre_student', 'created', 'last_sign_in'],
          rows
        )
      );
    });
}
