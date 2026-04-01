import fs from 'fs';
import { findProjectRoot, loadConfig, dbPath, wardDataDir } from '../config';
import { ThreatDB, DeltaSyncClient } from '@ward/shared';

const DEFAULT_SYNC_URL = 'https://api.wardshield.com/sync';

// Server's Ed25519 public key (base64)
const SERVER_PUBLIC_KEY_B64 = '3G7XRah/h0YWhKCjIIeVxrePAECJvbWVfm0HLD6ulQM=';

export async function syncCommand(options: { json?: boolean } = {}): Promise<void> {
  const projectDir = findProjectRoot(process.cwd());

  if (!projectDir) {
    console.error('No package.json found — run `ward init` first');
    process.exit(1);
  }

  // Ensure .ward directory exists
  wardDataDir(projectDir);
  const dbFile = dbPath(projectDir);
  const db = new ThreatDB(dbFile);
  const config = loadConfig(projectDir);
  const syncUrl = config.cloudUrl
    ? `${config.cloudUrl.replace(/\/$/, '')}/sync`
    : DEFAULT_SYNC_URL;

  const publicKey = new Uint8Array(Buffer.from(SERVER_PUBLIC_KEY_B64, 'base64'));

  const client = new DeltaSyncClient({
    db,
    publicKey,
    syncUrl,
  });

  const result = await client.sync();
  db.close();

  if (options.json) {
    console.log(JSON.stringify(result));
    return;
  }

  switch (result.status) {
    case 'updated':
      console.log(`✓ Synced: ${result.newThreats} new threat${result.newThreats === 1 ? '' : 's'} added`);
      break;
    case 'current':
      console.log('✓ Threat database is up to date');
      break;
    case 'offline':
      console.log(`⚠ Sync failed (offline): ${result.error}`);
      break;
    case 'error':
      console.log(`⚠ Sync failed: ${result.error}`);
      break;
  }
}
