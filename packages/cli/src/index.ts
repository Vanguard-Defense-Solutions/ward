#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init';
import { statusCommand } from './commands/status';
import { scanCommand } from './commands/scan';
import { checkInstallCommand } from './commands/check-install';
import { seedCommand } from './commands/seed';

const program = new Command();

program
  .name('ward')
  .description('AI development safety — protect your supply chain')
  .version('0.3.0')
  .option('--clinical', 'Show technical/CVE-style output')
  .option('--verbose', 'Show all signals, check time, and checks ran');

program
  .command('init')
  .description('Initialize Ward in the current project')
  .option('--json', 'Output as JSON')
  .action((opts) => {
    const globalOpts = program.opts();
    initCommand({ ...opts, ...globalOpts });
  });

program
  .command('status')
  .description('Show protection status')
  .option('--json', 'Output as JSON')
  .action((opts) => {
    const globalOpts = program.opts();
    statusCommand({ ...opts, ...globalOpts });
  });

program
  .command('scan')
  .description('Scan project dependencies for threats')
  .option('--json', 'Output as JSON')
  .action((opts) => {
    const globalOpts = program.opts();
    scanCommand({ ...opts, ...globalOpts });
  });

program
  .command('seed')
  .description('Seed the threat database with known attacks')
  .option('--json', 'Output as JSON')
  .action((opts) => {
    const globalOpts = program.opts();
    seedCommand({ ...opts, ...globalOpts });
  });

program
  .command('check-install')
  .description(false as any) // Hidden command — invoked by npm preinstall hook
  .argument('[packages...]', 'Packages to check')
  .option('--json', 'Output as JSON')
  .action(async (packages, opts) => {
    const globalOpts = program.opts();
    await checkInstallCommand({ ...opts, ...globalOpts, packages });
  });

program.parse();
