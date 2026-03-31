import fs from 'fs';
import path from 'path';
import { findProjectRoot, loadConfig, dbPath } from '../config';
import { formatStatus } from '../output';
import { LocalEngine } from '@ward/shared';

export function statusCommand(options: { json?: boolean } = {}): void {
  const projectDir = findProjectRoot(process.cwd());

  if (!projectDir) {
    console.log(formatStatus({
      initialized: false,
      dbAge: null,
      threatCount: 0,
      sensitivity: 'normal',
    }, !!options.json));
    return;
  }

  const rcPath = path.join(projectDir, '.wardrc');
  if (!fs.existsSync(rcPath)) {
    console.log(formatStatus({
      initialized: false,
      dbAge: null,
      threatCount: 0,
      sensitivity: 'normal',
    }, !!options.json));
    return;
  }

  const config = loadConfig(projectDir);
  const dbFile = dbPath(projectDir);

  let threatCount = 0;
  let lastSync: string | null = null;

  if (fs.existsSync(dbFile)) {
    const engine = new LocalEngine({
      dbPath: dbFile,
      topPackages: [],
      config,
    });
    threatCount = engine.getDB().count();
    lastSync = engine.getDB().getLastSync();
    engine.close();
  }

  console.log(formatStatus({
    initialized: true,
    dbAge: lastSync,
    threatCount,
    sensitivity: config.sensitivity,
  }, !!options.json));
}
