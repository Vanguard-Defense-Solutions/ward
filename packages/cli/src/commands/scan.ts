import fs from 'fs';
import path from 'path';
import { findProjectRoot, loadConfig, dbPath } from '../config';
import { loadTopPackages } from '../top-packages';
import { formatScanResult, formatVerdictClinical, formatVerdictVerbose, formatVerdict } from '../output';
import type { VerdictDisplayOptions } from '../output';
import { LocalEngine } from '@ward/shared';
import type { Verdict } from '@ward/shared';

interface LockfilePackages {
  [key: string]: { version: string; scripts?: Record<string, string> };
}

function readLockfile(projectDir: string): Array<{ name: string; version: string; scripts?: Record<string, string> }> {
  const lockPath = path.join(projectDir, 'package-lock.json');
  if (!fs.existsSync(lockPath)) {
    throw new Error('no-lockfile');
  }

  let raw: any;
  try {
    raw = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
  } catch {
    throw new Error('corrupted-lockfile');
  }

  const packages: LockfilePackages = raw.packages || {};
  const deps: Array<{ name: string; version: string; scripts?: Record<string, string> }> = [];

  for (const [key, value] of Object.entries(packages)) {
    if (!key || key === '') continue; // root entry
    // Extract package name from node_modules path
    const name = key.replace(/^node_modules\//, '');
    if (name.includes('node_modules/')) continue; // nested deps
    deps.push({ name, version: value.version, scripts: value.scripts });
  }

  return deps;
}

export function scanCommand(options: { json?: boolean; clinical?: boolean; verbose?: boolean } = {}): void {
  const projectDir = findProjectRoot(process.cwd());

  if (!projectDir) {
    console.error('No package.json found');
    process.exit(1);
  }

  const config = loadConfig(projectDir);
  const dbFile = dbPath(projectDir);

  const engine = new LocalEngine({
    dbPath: dbFile,
    topPackages: loadTopPackages(),
    config,
  });

  let deps: Array<{ name: string; version: string; scripts?: Record<string, string> }>;
  try {
    deps = readLockfile(projectDir);
  } catch (err: any) {
    if (err.message === 'no-lockfile') {
      const msg = 'No lockfile found. Run npm install first.';
      if (options.json) {
        console.log(JSON.stringify({ error: msg }));
      } else {
        console.error(msg);
      }
      process.exit(1);
    }
    if (err.message === 'corrupted-lockfile') {
      const msg = 'Lockfile is corrupted. Delete package-lock.json and run npm install.';
      if (options.json) {
        console.log(JSON.stringify({ error: msg }));
      } else {
        console.error(msg);
      }
      process.exit(1);
    }
    throw err;
  }

  const verdicts: Verdict[] = [];
  const checkTimes: number[] = [];
  let blocked = 0;
  let warned = 0;
  let clean = 0;

  for (const dep of deps) {
    const start = Date.now();
    const verdict = engine.check({
      name: dep.name,
      version: dep.version,
      scripts: dep.scripts,
    });
    const elapsed = Date.now() - start;
    checkTimes.push(elapsed);
    verdicts.push(verdict);
    if (verdict.action === 'block') blocked++;
    else if (verdict.action === 'warn') warned++;
    else clean++;

    // Clinical or verbose per-verdict output (non-JSON)
    if (!options.json && options.clinical) {
      console.log(formatVerdictClinical(verdict, {
        packageName: dep.name,
        packageVersion: dep.version,
        checkTimeMs: elapsed,
      }));
    } else if (!options.json && options.verbose && verdict.action !== 'allow') {
      console.log(formatVerdictVerbose(verdict, {
        packageName: dep.name,
        packageVersion: dep.version,
        checkTimeMs: elapsed,
      }));
    }
  }

  engine.close();

  const totalCheckTime = checkTimes.reduce((a, b) => a + b, 0);

  if (options.clinical && !options.json) {
    // Clinical summary already printed per-verdict above
    console.log(`${deps.length} checked, ${blocked} blocked, ${warned} warned — ${totalCheckTime}ms`);
  } else if (options.verbose && !options.json) {
    console.log(formatScanResult({
      total: deps.length,
      blocked,
      warned,
      clean,
      verdicts,
    }, false));
    console.log(`  Total check time: ${totalCheckTime}ms`);
  } else {
    console.log(formatScanResult({
      total: deps.length,
      blocked,
      warned,
      clean,
      verdicts,
    }, !!options.json));
  }

  if (blocked > 0) process.exit(1);
}
