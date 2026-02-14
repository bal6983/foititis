import type { Command } from 'commander';
import { registerUsersListCommand } from './list.js';
import { registerUsersGetCommand } from './get.js';
import { registerUsersCreateCommand } from './create.js';
import { registerUsersDeleteCommand } from './delete.js';

export function registerUsersCommands(program: Command) {
  const users = program.command('users').description('Auth user management');

  registerUsersListCommand(users);
  registerUsersGetCommand(users);
  registerUsersCreateCommand(users);
  registerUsersDeleteCommand(users);
}
