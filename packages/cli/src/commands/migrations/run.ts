import type { Command } from 'commander';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { success, error } from '../../lib/display.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getProjectRoot(): string {
  return resolve(__dirname, '../../../../..');
}

export function registerMigrationsRunCommand(parent: Command) {
  parent
    .command('run')
    .description('Push pending migrations to the remote database (wraps supabase db push)')
    .action(() => {
      const root = getProjectRoot();
      try {
        console.log('Running migrations...\n');
        execSync('npx supabase db push', {
          cwd: root,
          encoding: 'utf-8',
          stdio: 'inherit',
        });
        success('Migrations applied successfully');
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        error(`Migration run failed: ${msg}`);
        console.log(
          '\nMake sure the Supabase CLI is installed and linked: npx supabase link'
        );
      }
    });
}
