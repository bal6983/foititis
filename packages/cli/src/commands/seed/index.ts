import type { Command } from 'commander';
import { registerSeedRunCommand } from './run.js';
import { registerSeedLookupCommand } from './lookup.js';

export function registerSeedCommands(program: Command) {
  const seed = program.command('seed').description('Seed data management');

  registerSeedRunCommand(seed);
  registerSeedLookupCommand(seed);
}
