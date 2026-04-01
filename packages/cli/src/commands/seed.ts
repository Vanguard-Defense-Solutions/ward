import fs from 'fs';
import path from 'path';
import { findProjectRoot, dbPath, wardDataDir } from '../config';
import { ThreatDB } from '@ward/shared';

export function seedCommand(options: { json?: boolean; silent?: boolean } = {}): void {
  const projectDir = findProjectRoot(process.cwd());

  if (!projectDir) {
    console.error('No package.json found — run `ward init` first');
    process.exit(1);
  }

  // Ensure .ward directory exists
  wardDataDir(projectDir);
  const dbFile = dbPath(projectDir);
  const db = new ThreatDB(dbFile);

  // Load seed data — check multiple locations (dev source, bundled dist, installed)
  const scriptDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
  const seedPaths = [
    path.resolve(scriptDir, '../../data/seed-threats.json'),
    path.resolve(scriptDir, '../data/seed-threats.json'),
    path.resolve(scriptDir, '../../../shared/data/seed-threats.json'),
    path.resolve(scriptDir, '../../../../packages/shared/data/seed-threats.json'),
  ];

  let threats: any[] = [];
  for (const p of seedPaths) {
    if (fs.existsSync(p)) {
      threats = JSON.parse(fs.readFileSync(p, 'utf-8'));
      break;
    }
  }

  if (threats.length === 0) {
    console.error('No seed data found');
    db.close();
    process.exit(1);
  }

  const before = db.count();
  db.insertThreats(threats);
  db.setLastSync(new Date().toISOString());
  const after = db.count();
  db.close();

  const added = after - before;

  if (!options.silent) {
    if (options.json) {
      console.log(JSON.stringify({ total: after, added, existing: before }));
    } else {
      console.log(`✓ Threat database seeded: ${after} threats (${added} new)`);
    }
  }
}
