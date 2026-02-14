import type { Command } from 'commander';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { success, error } from '../../lib/display.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getProjectRoot(): string {
  return resolve(__dirname, '../../../../..');
}

export function registerMigrationsCreateCommand(parent: Command) {
  parent
    .command('create <name>')
    .description('Create a new migration file (wraps supabase migration new)')
    .action((name: string) => {
      const root = getProjectRoot();
      try {
        const output = execSync(`npx supabase migration new ${name}`, {
          cwd: root,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        success(`Migration created: ${name}`);
        if (output.trim()) console.log(output);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        error(`Failed to create migration: ${msg}`);
        console.log(
          '\nMake sure the Supabase CLI is installed: npm install -g supabase'
        );
      }
    });
}
