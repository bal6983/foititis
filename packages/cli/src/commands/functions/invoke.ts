import type { Command } from 'commander';
import { getConfig } from '../../lib/config.js';
import { success, error } from '../../lib/display.js';
import ora from 'ora';

export function registerFunctionsInvokeCommand(parent: Command) {
  parent
    .command('invoke <name>')
    .description('Invoke an edge function via HTTP')
    .option('--body <json>', 'JSON body to send', '{}')
    .action(async (name: string, opts: { body: string }) => {
      const { supabaseUrl, serviceRoleKey } = getConfig();

      const url = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/${name}`;

      const spinner = ora(`Invoking ${name}...`).start();

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          body: opts.body,
        });

        spinner.stop();

        const text = await response.text();
        try {
          const parsed = JSON.parse(text);
          console.log(JSON.stringify(parsed, null, 2));
        } catch {
          console.log(text);
        }

        if (response.ok) {
          success(`${name} responded ${response.status} ${response.statusText}`);
        } else {
          error(`${name} responded ${response.status} ${response.statusText}`);
        }
      } catch (e: unknown) {
        spinner.stop();
        const msg = e instanceof Error ? e.message : String(e);
        error(`Invoke failed: ${msg}`);
      }
    });
}
