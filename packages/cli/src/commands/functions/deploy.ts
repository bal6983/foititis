import type { Command } from 'commander';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { success, error } from '../../lib/display.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getProjectRoot(): string {
  return resolve(__dirname, '../../../../..');
}

export function registerFunctionsDeployCommand(parent: Command) {
  parent
    .command('deploy [name]')
    .description('Deploy edge function(s). Omit name to deploy all.')
    .action((name?: string) => {
      const root = getProjectRoot();
      const cmd = name
        ? `npx supabase functions deploy ${name}`
        : 'npx supabase functions deploy';

      try {
        console.log(`Deploying ${name ?? 'all functions'}...\n`);
        execSync(cmd, { cwd: root, encoding: 'utf-8', stdio: 'inherit' });
        success(`Deployed: ${name ?? 'all functions'}`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        error(`Deploy failed: ${msg}`);
      }
    });
}
