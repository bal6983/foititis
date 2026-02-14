import type { Command } from 'commander';
import inquirer from 'inquirer';
import { adminClient } from '../../lib/supabase-admin.js';
import { renderRecord, success, error } from '../../lib/display.js';
import ora from 'ora';

export function registerUsersCreateCommand(parent: Command) {
  parent
    .command('create')
    .description('Create a new user (auth + profile)')
    .action(async () => {
      const answers = await inquirer.prompt([
        { type: 'input', name: 'email', message: 'Email:' },
        { type: 'password', name: 'password', message: 'Password:', mask: '*' },
        { type: 'input', name: 'display_name', message: 'Display name (optional):' },
        {
          type: 'confirm',
          name: 'is_pre_student',
          message: 'Is pre-student?',
          default: false,
        },
        {
          type: 'confirm',
          name: 'email_confirm',
          message: 'Auto-confirm email?',
          default: true,
        },
      ]);

      const spinner = ora('Creating user...').start();

      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email: answers.email,
        password: answers.password,
        email_confirm: answers.email_confirm,
        user_metadata: {
          is_pre_student: answers.is_pre_student,
        },
      });

      if (authError) {
        spinner.stop();
        error(`Auth create failed: ${authError.message}`);
        return;
      }

      // Create profile
      const profileData: Record<string, unknown> = {
        id: authData.user.id,
        email: answers.email,
        is_pre_student: answers.is_pre_student,
        is_verified_student: !answers.is_pre_student,
      };

      if (answers.display_name.trim()) {
        profileData.display_name = answers.display_name.trim();
      }

      const { data: profile, error: profileError } = await adminClient
        .from('profiles')
        .insert(profileData)
        .select()
        .single();

      spinner.stop();

      if (profileError) {
        error(`Profile create failed (auth user was created): ${profileError.message}`);
        return;
      }

      success('User created successfully');
      console.log(renderRecord(profile));
    });
}
