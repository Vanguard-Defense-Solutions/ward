import { describe, it, expect, beforeEach } from 'vitest';
import { generateKeyPair, sign, verify } from './db-signer';

describe('DB Signature Verification', () => {
  let publicKey: Uint8Array;
  let privateKey: Uint8Array;

  beforeEach(async () => {
    const keys = await generateKeyPair();
    publicKey = keys.publicKey;
    privateKey = keys.privateKey;
  });

  it('sign produces an Ed25519 signature', async () => {
    const data = new TextEncoder().encode('hello world');
    const signature = await sign(data, privateKey);
    expect(signature).toBeInstanceOf(Uint8Array);
    expect(signature.length).toBe(64); // Ed25519 signatures are 64 bytes
  });

  it('verify returns true for valid signature', async () => {
    const data = new TextEncoder().encode('threat database content');
    const signature = await sign(data, privateKey);
    const valid = await verify(data, signature, publicKey);
    expect(valid).toBe(true);
  });

  it('verify returns false for tampered data', async () => {
    const data = new TextEncoder().encode('original data');
    const signature = await sign(data, privateKey);
    const tampered = new TextEncoder().encode('tampered data');
    const valid = await verify(tampered, signature, publicKey);
    expect(valid).toBe(false);
  });

  it('verify returns false for wrong key', async () => {
    const data = new TextEncoder().encode('some data');
    const signature = await sign(data, privateKey);
    const otherKeys = await generateKeyPair();
    const valid = await verify(data, signature, otherKeys.publicKey);
    expect(valid).toBe(false);
  });

  it('roundtrips sign + verify on binary data', async () => {
    const data = new Uint8Array([0, 1, 2, 255, 128, 64]);
    const signature = await sign(data, privateKey);
    expect(await verify(data, signature, publicKey)).toBe(true);
  });

  it('integration: sign a DB snapshot, verify, tamper, verify fails', async () => {
    // Simulate DB snapshot as bytes
    const dbSnapshot = new TextEncoder().encode(JSON.stringify({
      threats: [{ package: 'evil-pkg', version: '1.0.0' }],
      timestamp: '2026-03-31T00:00:00Z',
    }));

    const signature = await sign(dbSnapshot, privateKey);
    expect(await verify(dbSnapshot, signature, publicKey)).toBe(true);

    // Tamper with the snapshot
    const tamperedSnapshot = new TextEncoder().encode(JSON.stringify({
      threats: [{ package: 'evil-pkg', version: '1.0.0' }, { package: 'injected', version: '0.0.1' }],
      timestamp: '2026-03-31T00:00:00Z',
    }));
    expect(await verify(tamperedSnapshot, signature, publicKey)).toBe(false);
  });
});
