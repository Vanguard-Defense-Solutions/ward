#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init';
import { statusCommand } from './commands/status';
import { scanCommand } from './commands/scan';

const program = new Command();

program
  .name('ward')
  .description('AI development safety — protect your supply chain')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize Ward in the current project')
  .option('--json', 'Output as JSON')
  .action((opts) => initCommand(opts));

program
  .command('status')
  .description('Show protection status')
  .option('--json', 'Output as JSON')
  .action((opts) => statusCommand(opts));

program
  .command('scan')
  .description('Scan project dependencies for threats')
  .option('--json', 'Output as JSON')
  .action((opts) => scanCommand(opts));

program.parse();
