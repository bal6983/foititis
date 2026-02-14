import type { Command } from 'commander';
import { registerFunctionsListCommand } from './list.js';
import { registerFunctionsDeployCommand } from './deploy.js';
import { registerFunctionsInvokeCommand } from './invoke.js';

export function registerFunctionsCommands(program: Command) {
  const functions = program.command('functions').description('Edge function management');

  registerFunctionsListCommand(functions);
  registerFunctionsDeployCommand(functions);
  registerFunctionsInvokeCommand(functions);
}
