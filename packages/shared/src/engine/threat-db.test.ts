import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ThreatDB } from './threat-db';
import path from 'path';
import fs from 'fs';
import os from 'os';

describe('ThreatDB', () => {
  let db: ThreatDB;
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `ward-test-${Date.now()}.db`);
    db = new ThreatDB(dbPath);
  });

  afterEach(() => {
    db.close();
    try { fs.unlinkSync(dbPath); } catch {}
    try { fs.unlinkSync(dbPath + '-wal'); } catch {}
    try { fs.unlinkSync(dbPath + '-shm'); } catch {}
  });

  // --- Unit tests: DB operations ---

  describe('initialization', () => {
    it('creates the database file and schema', () => {
      expect(fs.existsSync(dbPath)).toBe(true);
    });

    it('uses WAL mode for concurrent reads', () => {
      const mode = db.getPragma('journal_mode');
      expect(mode).toBe('wal');
    });

    it('creates the threats table', () => {
      const tables = db.listTables();
      expect(tables).toContain('threats');
    });

    it('creates the metadata table for sync tracking', () => {
      const tables = db.listTables();
      expect(tables).toContain('metadata');
    });
  });

  describe('lookup', () => {
    beforeEach(() => {
      db.insertThreat({
        package_name: 'axios',
        version: '1.14.1',
        threat_type: 'malicious-code',
        description: 'This version steals SSH keys and cloud credentials',
        safe_version: '1.14.0',
        detected_at: '2026-03-31T00:00:00Z',
      });
    });

    it('returns a critical signal for a known threat', () => {
      const signal = db.lookup('axios', '1.14.1');
      expect(signal).not.toBeNull();
      expect(signal!.severity).toBe('critical');
      expect(signal!.type).toBe('known-threat');
    });

    it('includes the safe version in the signal', () => {
      const signal = db.lookup('axios', '1.14.1');
      expect(signal!.safeVersion).toBe('1.14.0');
    });

    it('includes a human-readable description', () => {
      const signal = db.lookup('axios', '1.14.1');
      expect(signal!.message).toContain('SSH keys');
    });

    it('returns null for a safe package', () => {
      const signal = db.lookup('axios', '1.14.0');
      expect(signal).toBeNull();
    });

    it('returns null for an unknown package', () => {
      const signal = db.lookup('totally-safe-pkg', '1.0.0');
      expect(signal).toBeNull();
    });

    it('handles scoped packages', () => {
      db.insertThreat({
        package_name: '@malicious/pkg',
        version: '1.0.0',
        threat_type: 'malicious-code',
        description: 'Steals credentials',
        detected_at: '2026-03-31T00:00:00Z',
      });
      const signal = db.lookup('@malicious/pkg', '1.0.0');
      expect(signal).not.toBeNull();
    });

    it('is case-sensitive on package names', () => {
      const signal = db.lookup('Axios', '1.14.1');
      expect(signal).toBeNull();
    });
  });

  describe('bulk operations', () => {
    it('inserts multiple threats in a transaction', () => {
      const threats = [
        { package_name: 'bad-pkg-1', version: '1.0.0', threat_type: 'malware', description: 'Malware', detected_at: '2026-01-01T00:00:00Z' },
        { package_name: 'bad-pkg-2', version: '2.0.0', threat_type: 'malware', description: 'Malware', detected_at: '2026-01-01T00:00:00Z' },
      ];
      db.insertThreats(threats);
      expect(db.lookup('bad-pkg-1', '1.0.0')).not.toBeNull();
      expect(db.lookup('bad-pkg-2', '2.0.0')).not.toBeNull();
    });

    it('handles empty bulk insert gracefully', () => {
      expect(() => db.insertThreats([])).not.toThrow();
    });

    it('reports threat count', () => {
      db.insertThreats([
        { package_name: 'a', version: '1.0.0', threat_type: 'x', description: 'x', detected_at: '2026-01-01T00:00:00Z' },
        { package_name: 'b', version: '1.0.0', threat_type: 'x', description: 'x', detected_at: '2026-01-01T00:00:00Z' },
      ]);
      expect(db.count()).toBe(2);
    });
  });

  describe('delta sync', () => {
    it('stores last sync timestamp', () => {
      db.setLastSync('2026-03-31T12:00:00Z');
      expect(db.getLastSync()).toBe('2026-03-31T12:00:00Z');
    });

    it('returns null when never synced', () => {
      expect(db.getLastSync()).toBeNull();
    });

    it('upserts threats on delta sync (no duplicates)', () => {
      db.insertThreat({
        package_name: 'pkg',
        version: '1.0.0',
        threat_type: 'malware',
        description: 'Old description',
        detected_at: '2026-01-01T00:00:00Z',
      });
      db.insertThreat({
        package_name: 'pkg',
        version: '1.0.0',
        threat_type: 'malware',
        description: 'Updated description',
        detected_at: '2026-01-02T00:00:00Z',
      });
      const signal = db.lookup('pkg', '1.0.0');
      expect(signal!.message).toContain('Updated description');
    });
  });

  // --- Edge cases ---

  describe('edge cases', () => {
    it('handles very long package names', () => {
      const longName = 'a'.repeat(214); // npm max package name length
      db.insertThreat({
        package_name: longName,
        version: '1.0.0',
        threat_type: 'malware',
        description: 'test',
        detected_at: '2026-01-01T00:00:00Z',
      });
      expect(db.lookup(longName, '1.0.0')).not.toBeNull();
    });

    it('handles unicode in package names', () => {
      db.insertThreat({
        package_name: 'pàckage',
        version: '1.0.0',
        threat_type: 'malware',
        description: 'test',
        detected_at: '2026-01-01T00:00:00Z',
      });
      expect(db.lookup('pàckage', '1.0.0')).not.toBeNull();
    });

    it('handles prerelease versions', () => {
      db.insertThreat({
        package_name: 'pkg',
        version: '1.0.0-rc.1',
        threat_type: 'malware',
        description: 'test',
        detected_at: '2026-01-01T00:00:00Z',
      });
      expect(db.lookup('pkg', '1.0.0-rc.1')).not.toBeNull();
      expect(db.lookup('pkg', '1.0.0')).toBeNull();
    });

    it('rejects SQL injection in getPragma', () => {
      expect(() => db.getPragma('journal_mode; DROP TABLE threats')).toThrow('Invalid pragma name');
      expect(() => db.getPragma('journal_mode')).not.toThrow();
    });
  });
});
