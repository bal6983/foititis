#!/usr/bin/env node
import { Command } from 'commander';
import { registerDbCommands } from './commands/db/index.js';
import { registerUsersCommands } from './commands/users/index.js';
import { registerMigrationsCommands } from './commands/migrations/index.js';
import { registerSeedCommands } from './commands/seed/index.js';
import { registerFunctionsCommands } from './commands/functions/index.js';
import { registerRlsCommands } from './commands/rls/index.js';

const program = new Command();

program
  .name('foititis-cli')
  .description('Supabase Admin CLI for foititis-site')
  .version('0.0.0');

registerDbCommands(program);
registerUsersCommands(program);
registerMigrationsCommands(program);
registerSeedCommands(program);
registerFunctionsCommands(program);
registerRlsCommands(program);

program.parse();
