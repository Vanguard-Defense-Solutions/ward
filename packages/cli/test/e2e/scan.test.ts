import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CLI_PATH = path.resolve(__dirname, '../../src/index.ts');
const RUN = `bun ${CLI_PATH}`;

describe('E2E: ward scan', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ward-e2e-scan-'));
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      dependencies: { express: '^4.19.0', lodash: '^4.17.21' },
    }));
    // Create a minimal package-lock.json
    fs.writeFileSync(path.join(tmpDir, 'package-lock.json'), JSON.stringify({
      name: 'test-project',
      lockfileVersion: 3,
      packages: {
        'node_modules/express': { version: '4.19.0' },
        'node_modules/lodash': { version: '4.17.21' },
      },
    }));
    // Init ward
    execSync(`${RUN} init`, { cwd: tmpDir, stdio: 'pipe' });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('scans dependencies and reports clean', () => {
    const result = execSync(`${RUN} scan`, {
      cwd: tmpDir,
      encoding: 'utf-8',
    });
    expect(result).toContain('All clear');
    expect(result).toContain('2');
  });

  it('fails with error when no lockfile exists', () => {
    fs.unlinkSync(path.join(tmpDir, 'package-lock.json'));
    try {
      execSync(`${RUN} scan`, {
        cwd: tmpDir,
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      expect.fail('Should have thrown');
    } catch (e: any) {
      const output = (e.stderr?.toString() ?? '') + (e.stdout?.toString() ?? '') + (e.message ?? '');
      expect(output).toContain('No lockfile found');
    }
  });

  it('fails with error when lockfile is corrupted', () => {
    fs.writeFileSync(path.join(tmpDir, 'package-lock.json'), '{{{not valid json!!!');
    try {
      execSync(`${RUN} scan`, {
        cwd: tmpDir,
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      expect.fail('Should have thrown');
    } catch (e: any) {
      const output = (e.stderr?.toString() ?? '') + (e.stdout?.toString() ?? '') + (e.message ?? '');
      expect(output).toContain('corrupted');
    }
  });

  it('outputs JSON with verdicts array when --json flag is used', () => {
    const result = execSync(`${RUN} scan --json`, {
      cwd: tmpDir,
      encoding: 'utf-8',
    });
    const parsed = JSON.parse(result.trim());
    expect(parsed.total).toBe(2);
    expect(parsed.blocked).toBe(0);
    expect(Array.isArray(parsed.verdicts)).toBe(true);
    expect(parsed.verdicts.length).toBe(2);
    expect(parsed.verdicts[0]).toHaveProperty('action');
    expect(parsed.verdicts[0]).toHaveProperty('signals');
  });
});
