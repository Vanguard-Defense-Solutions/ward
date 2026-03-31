import fs from 'fs';
import path from 'path';
import { findProjectRoot, loadConfig, dbPath } from '../config';
import { loadTopPackages } from '../top-packages';
import { formatScanResult } from '../output';
import { LocalEngine } from '@ward/shared';
import type { Verdict } from '@ward/shared';

interface LockfilePackages {
  [key: string]: { version: string; scripts?: Record<string, string> };
}

function readLockfile(projectDir: string): Array<{ name: string; version: string; scripts?: Record<string, string> }> {
  const lockPath = path.join(projectDir, 'package-lock.json');
  if (!fs.existsSync(lockPath)) {
    return [];
  }

  try {
    const raw = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
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
  } catch {
    return [];
  }
}

export function scanCommand(options: { json?: boolean } = {}): void {
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

  const deps = readLockfile(projectDir);
  const verdicts: Verdict[] = [];
  let blocked = 0;
  let warned = 0;
  let clean = 0;

  for (const dep of deps) {
    const verdict = engine.check({
      name: dep.name,
      version: dep.version,
      scripts: dep.scripts,
    });
    verdicts.push(verdict);
    if (verdict.action === 'block') blocked++;
    else if (verdict.action === 'warn') warned++;
    else clean++;
  }

  engine.close();

  console.log(formatScanResult({
    total: deps.length,
    blocked,
    warned,
    clean,
    verdicts,
  }, !!options.json));

  if (blocked > 0) process.exit(1);
}
