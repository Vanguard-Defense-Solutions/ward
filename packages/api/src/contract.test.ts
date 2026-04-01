/**
 * Contract tests: DeltaSyncClient <-> Ward API
 *
 * These tests verify that the CLI's delta sync client and the API's
 * sync endpoint agree on their shared contract:
 *   - /sync returns { payload, signature }
 *   - payload is a JSON string containing { threats: ThreatEntry[], timestamp: string }
 *   - signature is a base64-encoded Ed25519 signature over the payload
 *   - DeltaSyncClient can parse, verify, and apply the response
 *   - /check returns a Verdict the CLI can interpret
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { createApp, type AppDeps } from './app';
import { RateLimiter } from './rate-limit';
import { generateKeyPair, sign, verify } from '@ward/shared/engine/db-signer';
import { DeltaSyncClient } from '@ward/shared/sync/delta-sync';
import { ThreatDB } from '@ward/shared/engine/threat-db';
import type { ThreatEntry, Verdict } from '@ward/shared/types';
import type { Hono } from 'hono';

// Shared seed data
const SEED_THREATS: ThreatEntry[] = [
  {
    package_name: 'axios',
    version: '1.14.1',
    threat_type: 'backdoor',
    description: 'Maintainer account hijacked. RAT dropper.',
    safe_version: '1.14.0',
    detected_at: '2026-03-30T00:00:00Z',
  },
  {
    package_name: 'event-stream',
    version: '3.3.6',
    threat_type: 'backdoor',
    description: 'Attacker gained maintainer access via social engineering.',
    safe_version: '3.3.5',
    detected_at: '2018-11-26T00:00:00Z',
  },
  {
    package_name: 'colors',
    version: '1.4.1',
    threat_type: 'malicious-code',
    description: 'Maintainer sabotage. Infinite loop.',
    safe_version: '1.4.0',
    detected_at: '2022-01-08T00:00:00Z',
  },
];

const TOP_PACKAGES = ['react', 'express', 'lodash', 'axios', 'typescript'];

describe('Contract: DeltaSyncClient <-> /sync endpoint', () => {
  let serverDbPath: string;
  let clientDbPath: string;
  let keys: { publicKey: Uint8Array; privateKey: Uint8Array };
  let app: Hono;
  let rateLimiter: RateLimiter;
  let serverCleanup: () => void;

  beforeEach(async () => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    serverDbPath = path.join(os.tmpdir(), `ward-contract-server-${id}.db`);
    clientDbPath = path.join(os.tmpdir(), `ward-contract-client-${id}.db`);
    keys = await generateKeyPair();
    rateLimiter = new RateLimiter({ windowMs: 60_000, maxRequests: 1000 });

    const result = createApp({
      dbPath: serverDbPath,
      keys,
      topPackages: TOP_PACKAGES,
      seedThreats: SEED_THREATS,
      rateLimiter,
    });
    app = result.app;
    serverCleanup = () => {
      result.db.close();
      try { fs.unlinkSync(serverDbPath); } catch {}
      try { fs.unlinkSync(serverDbPath + '-wal'); } catch {}
      try { fs.unlinkSync(serverDbPath + '-shm'); } catch {}
    };
  });

  afterEach(() => {
    serverCleanup();
    try { fs.unlinkSync(clientDbPath); } catch {}
    try { fs.unlinkSync(clientDbPath + '-wal'); } catch {}
    try { fs.unlinkSync(clientDbPath + '-shm'); } catch {}
  });

  /**
   * Helper: create a fetch function that routes requests through Hono's
   * app.request() so we don't need a real HTTP server.
   */
  function createAppFetch(): typeof globalThis.fetch {
    return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input.toString();
      // Extract the path portion from the URL
      const urlObj = new URL(url);
      const pathAndQuery = urlObj.pathname + urlObj.search;
      return app.request(pathAndQuery, init);
    };
  }

  it('sync client can parse the API response', async () => {
    // 1. Create a fresh client DB
    const clientDb = new ThreatDB(clientDbPath);

    try {
      // 2. Verify client starts empty
      expect(clientDb.count()).toBe(0);

      // 3. Create a DeltaSyncClient that hits the API app
      const client = new DeltaSyncClient({
        db: clientDb,
        publicKey: keys.publicKey,
        syncUrl: 'http://localhost/sync',
        fetchFn: createAppFetch(),
      });

      // 4. Sync
      const result = await client.sync();

      // 5. Verify sync succeeded
      expect(result.status).toBe('updated');
      expect(result.newThreats).toBe(SEED_THREATS.length);

      // 6. Verify threats are in the client's DB
      expect(clientDb.count()).toBe(SEED_THREATS.length);

      const allThreats = clientDb.all();
      const packageNames = allThreats.map((t) => t.package_name);
      expect(packageNames).toContain('axios');
      expect(packageNames).toContain('event-stream');
      expect(packageNames).toContain('colors');
    } finally {
      clientDb.close();
    }
  });

  it('sync client rejects tampered API response', async () => {
    // Create a fetch function that tampers with the payload
    const tamperingFetch: typeof globalThis.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      const urlObj = new URL(url);
      const pathAndQuery = urlObj.pathname + urlObj.search;
      const realResponse = await app.request(pathAndQuery, init);

      // Get the real response body
      const body = await realResponse.json();

      // Tamper with the payload (inject a fake threat)
      const payload = JSON.parse(body.payload);
      payload.threats.push({
        package_name: 'injected-malware',
        version: '0.0.1',
        threat_type: 'backdoor',
        description: 'INJECTED BY ATTACKER',
        detected_at: '2026-03-31T00:00:00Z',
      });
      body.payload = JSON.stringify(payload);
      // Keep the original signature (now invalid for the tampered payload)

      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const clientDb = new ThreatDB(clientDbPath);

    try {
      const client = new DeltaSyncClient({
        db: clientDb,
        publicKey: keys.publicKey,
        syncUrl: 'http://localhost/sync',
        fetchFn: tamperingFetch,
      });

      const result = await client.sync();

      // Sync should fail due to invalid signature
      expect(result.status).toBe('error');
      expect(result.error).toContain('Invalid signature');

      // Client DB should remain empty (no threats applied)
      expect(clientDb.count()).toBe(0);
    } finally {
      clientDb.close();
    }
  });

  it('delta sync client sends correct since parameter', async () => {
    const clientDb = new ThreatDB(clientDbPath);

    try {
      // 1. First full sync to get all threats
      const client = new DeltaSyncClient({
        db: clientDb,
        publicKey: keys.publicKey,
        syncUrl: 'http://localhost/sync',
        fetchFn: createAppFetch(),
      });

      const firstSync = await client.sync();
      expect(firstSync.status).toBe('updated');
      expect(firstSync.newThreats).toBe(3);
      expect(clientDb.count()).toBe(3);

      // 2. Record what the client's last sync timestamp is
      const lastSync = clientDb.getLastSync();
      expect(lastSync).toBeDefined();

      // 3. Second sync should get zero new threats (nothing added to server
      //    after the first sync's timestamp)
      const secondSync = await client.sync();
      // The client sends ?since=<lastSync> and the server returns 0 threats
      // since nothing was added after the first sync
      expect(secondSync.status).toBe('updated');
      expect(secondSync.newThreats).toBe(0);

      // 4. Client DB should still have the same 3 threats
      expect(clientDb.count()).toBe(3);
    } finally {
      clientDb.close();
    }
  });

  it('check-install can use /check endpoint as fallback', async () => {
    // 1. Call POST /check with a known malicious package
    const res = await app.request('/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ package_name: 'axios', version: '1.14.1' }),
    });

    expect(res.status).toBe(200);

    // 2. Parse the response as a Verdict
    const verdict: Verdict = await res.json();

    // 3. Verify it's a valid Verdict structure
    expect(verdict.action).toBe('block');
    expect(verdict.summary).toBeDefined();
    expect(typeof verdict.summary).toBe('string');
    expect(Array.isArray(verdict.signals)).toBe(true);
    expect(verdict.signals.length).toBeGreaterThan(0);

    // 4. Verify the signal has correct structure the CLI expects
    const threatSignal = verdict.signals.find((s) => s.type === 'known-threat');
    expect(threatSignal).toBeDefined();
    expect(threatSignal!.severity).toBe('critical');
    expect(typeof threatSignal!.message).toBe('string');

    // 5. Safe version should be present for the CLI to display
    expect(verdict.safeVersion).toBe('1.14.0');
  });

  it('safe package check returns valid allow verdict', async () => {
    const res = await app.request('/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ package_name: 'lodash', version: '4.17.21' }),
    });

    expect(res.status).toBe(200);

    const verdict: Verdict = await res.json();

    // Verify it's a valid Verdict the CLI can process
    expect(verdict.action).toBe('allow');
    expect(verdict.summary).toBeDefined();
    expect(Array.isArray(verdict.signals)).toBe(true);
    // Allow verdict should not have safeVersion
    expect(verdict.safeVersion).toBeUndefined();
  });

  it('sync response payload matches ThreatEntry schema', async () => {
    // Verify the wire format matches exactly what ThreatEntry expects
    const res = await app.request('/sync');
    const body = await res.json();
    const payload = JSON.parse(body.payload);

    for (const threat of payload.threats) {
      // Every field the ThreatEntry interface requires must be present
      expect(typeof threat.package_name).toBe('string');
      expect(typeof threat.version).toBe('string');
      expect(typeof threat.threat_type).toBe('string');
      expect(typeof threat.description).toBe('string');
      expect(typeof threat.detected_at).toBe('string');
      // safe_version is optional but if present, must be a string
      if (threat.safe_version !== null && threat.safe_version !== undefined) {
        expect(typeof threat.safe_version).toBe('string');
      }
    }
  });

  it('sync response signature field is valid base64', async () => {
    const res = await app.request('/sync');
    const body = await res.json();

    // Verify signature is valid base64
    const decoded = Buffer.from(body.signature, 'base64');
    const reEncoded = decoded.toString('base64');
    expect(reEncoded).toBe(body.signature);

    // Ed25519 signatures are 64 bytes
    expect(decoded.length).toBe(64);
  });

  it('delta sync with since parameter only returns newer threats', async () => {
    // Directly test the API's since behavior matches what the client expects
    const fullRes = await app.request('/sync');
    const fullBody = await fullRes.json();
    const fullPayload = JSON.parse(fullBody.payload);

    // All 3 threats
    expect(fullPayload.threats.length).toBe(3);

    // Delta sync: only after 2022
    const deltaRes = await app.request('/sync?since=2022-01-01T00:00:00Z');
    const deltaBody = await deltaRes.json();
    const deltaPayload = JSON.parse(deltaBody.payload);

    // Should only include axios (2026) and colors (2022-01-08)
    expect(deltaPayload.threats.length).toBe(2);
    const names = deltaPayload.threats.map((t: ThreatEntry) => t.package_name);
    expect(names).toContain('axios');
    expect(names).toContain('colors');
    expect(names).not.toContain('event-stream');

    // Verify each returned threat is genuinely after the since date
    for (const threat of deltaPayload.threats) {
      expect(threat.detected_at > '2022-01-01T00:00:00Z').toBe(true);
    }

    // Both responses should have valid signatures
    const fullValid = await verify(
      new TextEncoder().encode(fullBody.payload),
      Uint8Array.from(Buffer.from(fullBody.signature, 'base64')),
      keys.publicKey,
    );
    expect(fullValid).toBe(true);

    const deltaValid = await verify(
      new TextEncoder().encode(deltaBody.payload),
      Uint8Array.from(Buffer.from(deltaBody.signature, 'base64')),
      keys.publicKey,
    );
    expect(deltaValid).toBe(true);
  });
});
