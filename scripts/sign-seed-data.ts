/**
 * Sign the seed-threats.json file with Ed25519.
 * Produces seed-threats.json.sig alongside it.
 *
 * Usage: bun run scripts/sign-seed-data.ts <private-key-path>
 *
 * The signature allows clients to verify that the seed data hasn't been
 * tampered with, even when downloaded from GitHub or npm.
 */
import fs from 'fs';
import path from 'path';
import { sign, generateKeyPair } from '../packages/shared/src/engine/db-signer';

const SEED_PATH = path.resolve(__dirname, '../packages/shared/data/seed-threats.json');
const SIG_PATH = SEED_PATH + '.sig';
const PUB_KEY_PATH = path.resolve(__dirname, '../packages/shared/data/seed-threats.pub');

async function main() {
  const privateKeyPath = process.argv[2];

  if (privateKeyPath === '--generate') {
    // Generate a new key pair for seed data signing
    const keys = await generateKeyPair();
    const keyDir = path.resolve(__dirname, '../.keys');
    fs.mkdirSync(keyDir, { recursive: true });
    fs.writeFileSync(path.join(keyDir, 'seed-signing.key'), Buffer.from(keys.privateKey));
    fs.writeFileSync(path.join(keyDir, 'seed-signing.pub'), Buffer.from(keys.publicKey));
    // Also copy public key to data dir (this one gets committed)
    fs.writeFileSync(PUB_KEY_PATH, Buffer.from(keys.publicKey));
    console.log(`Key pair generated:`);
    console.log(`  Private: .keys/seed-signing.key (DO NOT COMMIT)`);
    console.log(`  Public:  packages/shared/data/seed-threats.pub (commit this)`);
    console.log(`\nNow run: bun run scripts/sign-seed-data.ts .keys/seed-signing.key`);
    return;
  }

  if (!privateKeyPath) {
    console.error('Usage: bun run scripts/sign-seed-data.ts <private-key-path>');
    console.error('       bun run scripts/sign-seed-data.ts --generate');
    process.exit(1);
  }

  if (!fs.existsSync(privateKeyPath)) {
    console.error(`Private key not found: ${privateKeyPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(SEED_PATH)) {
    console.error(`Seed data not found: ${SEED_PATH}`);
    process.exit(1);
  }

  const privateKey = new Uint8Array(fs.readFileSync(privateKeyPath));
  const seedData = fs.readFileSync(SEED_PATH);
  const seedBytes = new Uint8Array(seedData);

  const signature = await sign(seedBytes, privateKey);
  fs.writeFileSync(SIG_PATH, Buffer.from(signature).toString('base64'));

  console.log(`Signed: ${SEED_PATH}`);
  console.log(`Signature: ${SIG_PATH}`);
  console.log(`Verify with public key: ${PUB_KEY_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
