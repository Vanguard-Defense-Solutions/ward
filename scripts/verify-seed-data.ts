/**
 * Verify the seed-threats.json signature.
 * Used by ward CLI during seed to ensure data hasn't been tampered with.
 *
 * Usage: bun run scripts/verify-seed-data.ts
 */
import fs from 'fs';
import path from 'path';
import { verify } from '../packages/shared/src/engine/db-signer';

const SEED_PATH = path.resolve(__dirname, '../packages/shared/data/seed-threats.json');
const SIG_PATH = SEED_PATH + '.sig';
const PUB_KEY_PATH = path.resolve(__dirname, '../packages/shared/data/seed-threats.pub');

async function main() {
  if (!fs.existsSync(SIG_PATH)) {
    console.log('No signature file found — seed data is unsigned');
    process.exit(0); // Don't fail, just warn
  }

  if (!fs.existsSync(PUB_KEY_PATH)) {
    console.error('Public key not found — cannot verify signature');
    process.exit(1);
  }

  const seedData = new Uint8Array(fs.readFileSync(SEED_PATH));
  const signatureB64 = fs.readFileSync(SIG_PATH, 'utf-8').trim();
  const signature = new Uint8Array(Buffer.from(signatureB64, 'base64'));
  const publicKey = new Uint8Array(fs.readFileSync(PUB_KEY_PATH));

  const valid = await verify(seedData, signature, publicKey);

  if (valid) {
    console.log('✓ Seed data signature is valid');
    process.exit(0);
  } else {
    console.error('✗ SIGNATURE VERIFICATION FAILED — seed data may have been tampered with');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
