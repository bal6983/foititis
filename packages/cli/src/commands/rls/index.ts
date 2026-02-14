import type { Command } from 'commander';
import { registerRlsTestCommand } from './test.js';

export function registerRlsCommands(program: Command) {
  const rls = program.command('rls').description('RLS policy testing');

  registerRlsTestCommand(rls);
}
