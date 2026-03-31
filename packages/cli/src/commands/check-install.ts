import fs from 'fs';
import path from 'path';
import { findProjectRoot, loadConfig, dbPath } from '../config';
import { loadTopPackages } from '../top-packages';
import { formatVerdict, formatVerdictJson, formatVerdictClinical, formatVerdictVerbose } from '../output';
import { LocalEngine } from '@ward/shared';

/**
 * Hidden command invoked by the npm preinstall hook.
 * Reads pending package installs from npm's environment and checks each one.
 * Exits 0 to allow install, exits 1 to block.
 */
export function checkInstallCommand(options: { json?: boolean; clinical?: boolean; verbose?: boolean } = {}): void {
  const projectDir = findProjectRoot(process.cwd());
  if (!projectDir) process.exit(0); // Can't find project — don't block

  const config = loadConfig(projectDir);
  const dbFile = dbPath(projectDir);
  const topPackages = loadTopPackages();

  // npm sets npm_config_argv with the original command arguments
  // npm also provides the package info via environment variables
  const npmArgv = process.env.npm_config_argv;
  const npmCommand = process.env.npm_command;

  // If this is `npm install` with no arguments (installing from lockfile), skip
  if (npmCommand === 'install' && !npmArgv) {
    process.exit(0);
  }

  // Parse packages from npm_config_argv
  let packages: string[] = [];
  if (npmArgv) {
    try {
      const parsed = JSON.parse(npmArgv);
      // parsed.remain contains the package names
      packages = (parsed.remain || []).filter((p: string) => !p.startsWith('-'));
    } catch {
      // If we can't parse argv, check cooked/original arrays
    }
  }

  // Fallback: check process.argv for package names passed to ward directly
  if (packages.length === 0) {
    packages = process.argv.slice(3).filter((a) => !a.startsWith('-'));
  }

  // If no packages to check, allow (lockfile install)
  if (packages.length === 0) {
    process.exit(0);
  }

  const engine = new LocalEngine({ dbPath: dbFile, topPackages, config });
  let blocked = false;

  for (const pkg of packages) {
    // Parse name@version
    const atIdx = pkg.lastIndexOf('@');
    const name = atIdx > 0 ? pkg.substring(0, atIdx) : pkg;
    const version = atIdx > 0 ? pkg.substring(atIdx + 1) : 'latest';

    const start = Date.now();
    const verdict = engine.check({ name, version });
    const checkTimeMs = Date.now() - start;

    let output: string;
    if (options.json) {
      output = formatVerdictJson(verdict);
    } else if (options.clinical) {
      output = formatVerdictClinical(verdict, { packageName: name, packageVersion: version, checkTimeMs });
    } else if (options.verbose) {
      output = formatVerdictVerbose(verdict, { packageName: name, packageVersion: version, checkTimeMs });
    } else {
      output = formatVerdict(verdict);
    }
    console.log(output);

    if (verdict.action === 'block') {
      blocked = true;
    }
  }

  engine.close();

  if (blocked) {
    process.exit(1);
  }
}
