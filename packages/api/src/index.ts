import path from 'path';
import fs from 'fs';
import { createApp } from './app';
import { loadOrCreateKeyPair } from './keys';
import type { ThreatEntry } from '@ward/shared/types';

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const scriptDir = (import.meta as any).dir ?? path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const SHARED_DATA = path.resolve(scriptDir, '..', '..', 'shared', 'data');
const DB_PATH = path.resolve(scriptDir, '..', 'data', 'ward-api.db');

// Load seed data
const seedPath = path.join(SHARED_DATA, 'seed-threats.json');
const topPkgPath = path.join(SHARED_DATA, 'top-packages.json');
const seedThreats: ThreatEntry[] = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
const topPackages: string[] = JSON.parse(fs.readFileSync(topPkgPath, 'utf-8'));

// Load or generate Ed25519 keys
const keys = await loadOrCreateKeyPair();

// Ensure data dir exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const { app } = createApp({
  dbPath: DB_PATH,
  keys,
  topPackages,
  seedThreats,
});

console.log(`Ward API v0.2.0`);
console.log(`Loaded ${seedThreats.length} seed threats`);
console.log(`Listening on http://localhost:${PORT}`);

export default {
  port: PORT,
  fetch: app.fetch,
};
