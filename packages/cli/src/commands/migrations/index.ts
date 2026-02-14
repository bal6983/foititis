import type { Command } from 'commander';
import { registerMigrationsListCommand } from './list.js';
import { registerMigrationsCreateCommand } from './create.js';
import { registerMigrationsRunCommand } from './run.js';

export function registerMigrationsCommands(program: Command) {
  const migrations = program.command('migrations').description('Database migration management');

  registerMigrationsListCommand(migrations);
  registerMigrationsCreateCommand(migrations);
  registerMigrationsRunCommand(migrations);
}
