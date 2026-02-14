import type { Command } from 'commander';
import { readdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderTable, error, info } from '../../lib/display.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getFunctionsDir(): string {
  return resolve(__dirname, '../../../../../supabase/functions');
}

export function registerFunctionsListCommand(parent: Command) {
  parent
    .command('list')
    .description('List edge functions')
    .action(() => {
      const functionsDir = getFunctionsDir();

      let entries: string[];
      try {
        entries = readdirSync(functionsDir).filter((name) => {
          try {
            return statSync(resolve(functionsDir, name)).isDirectory();
          } catch {
            return false;
          }
        });
      } catch {
        error(`Functions directory not found: ${functionsDir}`);
        return;
      }

      if (entries.length === 0) {
        info('No edge functions found');
        return;
      }

      const rows = entries.map((name) => {
        const dir = resolve(functionsDir, name);
        const files = readdirSync(dir);
        return {
          name,
          files: files.join(', '),
        };
      });

      console.log(`\nEdge Functions (${entries.length})\n`);
      console.log(renderTable(['name', 'files'], rows));
    });
}
