import type { Command } from 'commander';
import { registerListCommand } from './list.js';
import { registerGetCommand } from './get.js';
import { registerCreateCommand } from './create.js';
import { registerUpdateCommand } from './update.js';
import { registerDeleteCommand } from './delete.js';
import { registerCountCommand } from './count.js';
import { registerQueryCommand } from './query.js';

export function registerDbCommands(program: Command) {
  const db = program.command('db').description('CRUD operations on database tables');

  registerListCommand(db);
  registerGetCommand(db);
  registerCreateCommand(db);
  registerUpdateCommand(db);
  registerDeleteCommand(db);
  registerCountCommand(db);
  registerQueryCommand(db);
}
