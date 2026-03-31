import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DeltaSyncClient, SyncResult } from './delta-sync';
import { ThreatDB } from '../engine/threat-db';
import { generateKeyPair, sign } from '../engine/db-signer';
import path from 'path';
import fs from 'fs';
import os from 'os';

describe('Delta Sync Client', () => {
  let db: ThreatDB;
  let dbPath: string;
  let publicKey: Uint8Array;
  let privateKey: Uint8Array;

  beforeEach(async () => {
    dbPath = path.join(os.tmpdir(), `ward-sync-test-${Date.now()}.db`);
    db = new ThreatDB(dbPath);
    const keys = await generateKeyPair();
    publicKey = keys.publicKey;
    privateKey = keys.privateKey;
  });

  afterEach(() => {
    db.close();
    try { fs.unlinkSync(dbPath); } catch {}
    try { fs.unlinkSync(dbPath + '-wal'); } catch {}
    try { fs.unlinkSync(dbPath + '-shm'); } catch {}
  });

  function createClient(fetchFn?: typeof globalThis.fetch): DeltaSyncClient {
    return new DeltaSyncClient({
      db,
      publicKey,
      syncUrl: 'https://api.ward.dev/v1/sync',
      fetchFn,
    });
  }

  async function createSignedResponse(data: object): Promise<{ payload: string; signature: string }> {
    const payload = JSON.stringify(data);
    const sig = await sign(new TextEncoder().encode(payload), privateKey);
    return { payload, signature: Buffer.from(sig).toString('base64') };
  }

  it('sends last-sync timestamp in request', async () => {
    db.setLastSync('2026-03-30T00:00:00Z');
    let capturedUrl = '';

    const mockFetch = vi.fn(async (url: string) => {
      capturedUrl = url;
      const resp = await createSignedResponse({ threats: [], timestamp: '2026-03-31T00:00:00Z' });
      return new Response(JSON.stringify(resp), { status: 200 });
    }) as any;

    const client = createClient(mockFetch);
    await client.sync();

    expect(capturedUrl).toContain('since=2026-03-30T00%3A00%3A00Z');
  });

  it('applies delta entries to local DB', async () => {
    const resp = await createSignedResponse({
      threats: [
        { package_name: 'evil-pkg', version: '1.0.0', threat_type: 'malware', description: 'Bad stuff', detected_at: '2026-03-31T00:00:00Z' },
      ],
      timestamp: '2026-03-31T12:00:00Z',
    });

    const mockFetch = vi.fn(async () => new Response(JSON.stringify(resp), { status: 200 })) as any;
    const client = createClient(mockFetch);
    const result = await client.sync();

    expect(result.status).toBe('updated');
    expect(result.newThreats).toBe(1);
    expect(db.lookup('evil-pkg', '1.0.0')).not.toBeNull();
  });

  it('updates last-sync timestamp after success', async () => {
    const resp = await createSignedResponse({
      threats: [],
      timestamp: '2026-03-31T12:00:00Z',
    });

    const mockFetch = vi.fn(async () => new Response(JSON.stringify(resp), { status: 200 })) as any;
    const client = createClient(mockFetch);
    await client.sync();

    expect(db.getLastSync()).toBe('2026-03-31T12:00:00Z');
  });

  it('verifies signature before applying', async () => {
    // Tamper with the payload after signing
    const resp = await createSignedResponse({
      threats: [{ package_name: 'safe-pkg', version: '1.0.0', threat_type: 'malware', description: 'Fake', detected_at: '2026-03-31T00:00:00Z' }],
      timestamp: '2026-03-31T12:00:00Z',
    });

    // Modify the payload after signing (tamper)
    const tampered = { ...JSON.parse(resp.payload), threats: [{ package_name: 'injected', version: '0.0.1', threat_type: 'malware', description: 'Injected', detected_at: '2026-03-31T00:00:00Z' }] };
    const tamperedResp = { payload: JSON.stringify(tampered), signature: resp.signature };

    const mockFetch = vi.fn(async () => new Response(JSON.stringify(tamperedResp), { status: 200 })) as any;
    const client = createClient(mockFetch);
    const result = await client.sync();

    expect(result.status).toBe('error');
    expect(result.error).toContain('signature');
    // DB should NOT have the injected threat
    expect(db.lookup('injected', '0.0.1')).toBeNull();
  });

  it('gracefully handles network failure', async () => {
    const mockFetch = vi.fn(async () => { throw new Error('Network error'); }) as any;
    const client = createClient(mockFetch);
    const result = await client.sync();

    expect(result.status).toBe('offline');
    expect(result.error).toContain('Network');
  });

  it('gracefully handles timeout', async () => {
    const mockFetch = vi.fn(async () => { throw new Error('timeout'); }) as any;
    const client = createClient(mockFetch);
    const result = await client.sync();

    expect(result.status).toBe('offline');
  });

  it('works on first sync (no timestamp, gets full snapshot)', async () => {
    expect(db.getLastSync()).toBeNull();

    const resp = await createSignedResponse({
      threats: [
        { package_name: 'threat-1', version: '1.0.0', threat_type: 'malware', description: 'Test', detected_at: '2026-03-31T00:00:00Z' },
        { package_name: 'threat-2', version: '2.0.0', threat_type: 'malware', description: 'Test', detected_at: '2026-03-31T00:00:00Z' },
      ],
      timestamp: '2026-03-31T12:00:00Z',
    });

    const mockFetch = vi.fn(async () => new Response(JSON.stringify(resp), { status: 200 })) as any;
    const client = createClient(mockFetch);
    const result = await client.sync();

    expect(result.status).toBe('updated');
    expect(result.newThreats).toBe(2);
    expect(db.getLastSync()).toBe('2026-03-31T12:00:00Z');
  });

  it('handles server error response', async () => {
    const mockFetch = vi.fn(async () => new Response('Internal Server Error', { status: 500 })) as any;
    const client = createClient(mockFetch);
    const result = await client.sync();

    expect(result.status).toBe('error');
  });

  it('handles HTTP 304 Not Modified', async () => {
    const mockFetch = vi.fn(async () => new Response(null, { status: 304 })) as any;
    const client = createClient(mockFetch);
    const result = await client.sync();

    expect(result.status).toBe('current');
  });
});
