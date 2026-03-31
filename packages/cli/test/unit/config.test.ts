import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, saveConfig, findProjectRoot } from '../../src/config';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Config', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ward-config-'));
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('loadConfig', () => {
    it('returns defaults when no .wardrc exists', () => {
      const config = loadConfig(tmpDir);
      expect(config.sensitivity).toBe('normal');
      expect(config.allowlist).toEqual([]);
      expect(config.cloudEnabled).toBe(true);
    });

    it('parses valid JSON .wardrc', () => {
      fs.writeFileSync(path.join(tmpDir, '.wardrc'), JSON.stringify({ sensitivity: 'strict' }));
      const config = loadConfig(tmpDir);
      expect(config.sensitivity).toBe('strict');
    });

    it('rejects malformed .wardrc with clear error', () => {
      fs.writeFileSync(path.join(tmpDir, '.wardrc'), 'not json!!!');
      expect(() => loadConfig(tmpDir)).toThrow('Invalid .wardrc');
    });
  });

  describe('saveConfig', () => {
    it('writes valid JSON', () => {
      saveConfig(tmpDir, { sensitivity: 'strict' });
      const raw = fs.readFileSync(path.join(tmpDir, '.wardrc'), 'utf-8');
      const parsed = JSON.parse(raw);
      expect(parsed.sensitivity).toBe('strict');
    });

    it('is idempotent (re-init does not corrupt)', () => {
      saveConfig(tmpDir);
      saveConfig(tmpDir);
      const raw = fs.readFileSync(path.join(tmpDir, '.wardrc'), 'utf-8');
      const parsed = JSON.parse(raw);
      expect(parsed.sensitivity).toBe('normal');
    });
  });

  describe('findProjectRoot', () => {
    it('finds directory with package.json', () => {
      const root = findProjectRoot(tmpDir);
      expect(root).toBe(tmpDir);
    });

    it('does not return a directory without package.json', () => {
      const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ward-empty-'));
      const root = findProjectRoot(emptyDir);
      // May find a package.json in a parent directory, but not in emptyDir itself
      if (root !== null) {
        expect(root).not.toBe(emptyDir);
      } else {
        expect(root).toBeNull();
      }
      fs.rmSync(emptyDir, { recursive: true, force: true });
    });
  });
});
