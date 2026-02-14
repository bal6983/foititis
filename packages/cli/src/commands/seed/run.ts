import type { Command } from 'commander';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { success, error } from '../../lib/display.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getProjectRoot(): string {
  return resolve(__dirname, '../../../../..');
}

export function registerSeedRunCommand(parent: Command) {
  parent
    .command('run')
    .description('Run seed.sql against the remote database')
    .action(() => {
      const root = getProjectRoot();
      try {
        console.log('Running seed...\n');
        execSync('npx supabase db reset --linked', {
          cwd: root,
          encoding: 'utf-8',
          stdio: 'inherit',
        });
        success('Seed applied successfully');
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        error(`Seed failed: ${msg}`);
        console.log('\nMake sure the Supabase CLI is installed and linked.');
      }
    });
}
