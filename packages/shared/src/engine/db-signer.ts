import * as ed from '@noble/ed25519';
import { createHash } from 'crypto';

// noble/ed25519 v2 needs sha512
ed.etc.sha512Sync = (...m: Uint8Array[]) => {
  const h = createHash('sha512');
  for (const msg of m) h.update(msg);
  return new Uint8Array(h.digest());
};

export async function generateKeyPair(): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array }> {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);
  return { publicKey, privateKey };
}

export async function sign(data: Uint8Array, privateKey: Uint8Array): Promise<Uint8Array> {
  return ed.signAsync(data, privateKey);
}

export async function verify(data: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): Promise<boolean> {
  try {
    return await ed.verifyAsync(signature, data, publicKey);
  } catch {
    return false;
  }
}
