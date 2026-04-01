import fs from 'fs';
import path from 'path';
import { generateKeyPair } from '@ward/shared/engine/db-signer';

const DATA_DIR = path.resolve(import.meta.dir ?? '.', '..', 'data');

export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export async function loadOrCreateKeyPair(): Promise<KeyPair> {
  const pubPath = path.join(DATA_DIR, 'public.key');
  const privPath = path.join(DATA_DIR, 'private.key');

  if (fs.existsSync(pubPath) && fs.existsSync(privPath)) {
    return {
      publicKey: new Uint8Array(fs.readFileSync(pubPath)),
      privateKey: new Uint8Array(fs.readFileSync(privPath)),
    };
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const keys = await generateKeyPair();
  fs.writeFileSync(pubPath, Buffer.from(keys.publicKey));
  fs.writeFileSync(privPath, Buffer.from(keys.privateKey));

  return keys;
}
