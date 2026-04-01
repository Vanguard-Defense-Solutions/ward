import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { detectPackageManagers, pmDisplayLabels } from '../../src/commands/init';
import type { PackageManager } from '../../src/commands/init';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Package Manager Detection', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ward-pm-detect-'));
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-project' }));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('detectPackageManagers', () => {
    it('defaults to npm when no lockfile exists', () => {
      const result = detectPackageManagers(tmpDir);
      expect(result).toEqual(['npm']);
    });

    it('detects npm from package-lock.json', () => {
      fs.writeFileSync(path.join(tmpDir, 'package-lock.json'), '{}');
      const result = detectPackageManagers(tmpDir);
      expect(result).toContain('npm');
    });

    it('detects bun from bun.lockb', () => {
      fs.writeFileSync(path.join(tmpDir, 'bun.lockb'), '');
      const result = detectPackageManagers(tmpDir);
      expect(result).toContain('bun');
    });

    it('detects bun from bun.lock', () => {
      fs.writeFileSync(path.join(tmpDir, 'bun.lock'), '');
      const result = detectPackageManagers(tmpDir);
      expect(result).toContain('bun');
    });

    it('detects yarn classic from yarn.lock without .yarnrc.yml', () => {
      fs.writeFileSync(path.join(tmpDir, 'yarn.lock'), '');
      const result = detectPackageManagers(tmpDir);
      expect(result).toContain('yarn-classic');
      expect(result).not.toContain('yarn-berry');
    });

    it('detects yarn berry from yarn.lock with .yarnrc.yml', () => {
      fs.writeFileSync(path.join(tmpDir, 'yarn.lock'), '');
      fs.writeFileSync(path.join(tmpDir, '.yarnrc.yml'), 'nodeLinker: node-modules\n');
      const result = detectPackageManagers(tmpDir);
      expect(result).toContain('yarn-berry');
      expect(result).not.toContain('yarn-classic');
    });

    it('detects multiple PMs when multiple lockfiles exist', () => {
      fs.writeFileSync(path.join(tmpDir, 'package-lock.json'), '{}');
      fs.writeFileSync(path.join(tmpDir, 'bun.lockb'), '');
      fs.writeFileSync(path.join(tmpDir, 'yarn.lock'), '');
      const result = detectPackageManagers(tmpDir);
      expect(result).toContain('npm');
      expect(result).toContain('bun');
      // yarn-classic because no .yarnrc.yml
      expect(result).toContain('yarn-classic');
      expect(result).toHaveLength(3);
    });

    it('does not include npm as default when other PMs are detected', () => {
      fs.writeFileSync(path.join(tmpDir, 'bun.lockb'), '');
      const result = detectPackageManagers(tmpDir);
      expect(result).toEqual(['bun']);
      expect(result).not.toContain('npm');
    });
  });

  describe('pmDisplayLabels', () => {
    it('maps npm to "npm"', () => {
      expect(pmDisplayLabels(['npm'])).toEqual(['npm']);
    });

    it('maps bun to "bun"', () => {
      expect(pmDisplayLabels(['bun'])).toEqual(['bun']);
    });

    it('maps yarn-classic to "yarn"', () => {
      expect(pmDisplayLabels(['yarn-classic'])).toEqual(['yarn']);
    });

    it('maps yarn-berry to "yarn"', () => {
      expect(pmDisplayLabels(['yarn-berry'])).toEqual(['yarn']);
    });

    it('maps multiple PMs correctly', () => {
      const pms: PackageManager[] = ['npm', 'bun', 'yarn-berry'];
      expect(pmDisplayLabels(pms)).toEqual(['npm', 'bun', 'yarn']);
    });
  });
});
