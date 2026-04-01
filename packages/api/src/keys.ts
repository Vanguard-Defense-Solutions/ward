import fs from 'fs';
import path from 'path';
import { generateKeyPair } from '@ward/shared/engine/db-signer';

const DATA_DIR = path.resolve((import.meta as any).dir ?? path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..', 'data');

export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

/**
 * Resolve key file paths. Environment variables take precedence over defaults.
 *
 * - WARD_PUBLIC_KEY_PATH  → absolute path to the public key file
 * - WARD_PRIVATE_KEY_PATH → absolute path to the private key file
 */
export function resolveKeyPaths(): { pubPath: string; privPath: string } {
  const pubPath = process.env.WARD_PUBLIC_KEY_PATH || path.join(DATA_DIR, 'public.key');
  const privPath = process.env.WARD_PRIVATE_KEY_PATH || path.join(DATA_DIR, 'private.key');
  return { pubPath, privPath };
}

export async function loadOrCreateKeyPair(): Promise<KeyPair> {
  const { pubPath, privPath } = resolveKeyPaths();

  if (fs.existsSync(pubPath) && fs.existsSync(privPath)) {
    return {
      publicKey: new Uint8Array(fs.readFileSync(pubPath)),
      privateKey: new Uint8Array(fs.readFileSync(privPath)),
    };
  }

  // Auto-generate keys only when using default data directory
  const dir = path.dirname(privPath);
  fs.mkdirSync(dir, { recursive: true });
  const keys = await generateKeyPair();
  fs.writeFileSync(pubPath, Buffer.from(keys.publicKey));
  fs.writeFileSync(privPath, Buffer.from(keys.privateKey));

  return keys;
}
