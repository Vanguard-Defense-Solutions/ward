import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CLI_PATH = path.resolve(__dirname, '../../src/index.ts');
const RUN = `bun ${CLI_PATH}`;

describe('E2E: ward init', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ward-e2e-'));
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-project', version: '1.0.0' }));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates .wardrc in the project directory', () => {
    const result = execSync(`${RUN} init`, {
      cwd: tmpDir,
      encoding: 'utf-8',
    });
    expect(fs.existsSync(path.join(tmpDir, '.wardrc'))).toBe(true);
    expect(result).toContain('Ward initialized');
  });

  it('is idempotent (re-init preserves custom config)', () => {
    execSync(`${RUN} init`, { cwd: tmpDir, stdio: 'pipe' });
    // Write a custom config value
    const rcPath = path.join(tmpDir, '.wardrc');
    const config = JSON.parse(fs.readFileSync(rcPath, 'utf-8'));
    config.sensitivity = 'strict';
    fs.writeFileSync(rcPath, JSON.stringify(config, null, 2) + '\n');
    // Re-init should not overwrite
    const result = execSync(`${RUN} init`, {
      cwd: tmpDir,
      encoding: 'utf-8',
    });
    expect(result).toContain('Ward initialized');
    const afterConfig = JSON.parse(fs.readFileSync(rcPath, 'utf-8'));
    expect(afterConfig.sensitivity).toBe('strict');
  });

  it('fails gracefully when no package.json exists', () => {
    fs.unlinkSync(path.join(tmpDir, 'package.json'));
    try {
      execSync(`${RUN} init`, {
        cwd: tmpDir,
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      expect.fail('Should have thrown');
    } catch (e: any) {
      const output = (e.stderr?.toString() ?? '') + (e.stdout?.toString() ?? '') + (e.message ?? '');
      expect(output).toContain('package.json');
    }
  });

  it('outputs JSON when --json flag is used', () => {
    const result = execSync(`${RUN} init --json`, {
      cwd: tmpDir,
      encoding: 'utf-8',
    });
    const parsed = JSON.parse(result.trim());
    expect(parsed.success).toBe(true);
  });
});
