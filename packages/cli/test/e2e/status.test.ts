import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CLI_PATH = path.resolve(__dirname, '../../src/index.ts');
const RUN = `bun ${CLI_PATH}`;

describe('E2E: ward status', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ward-e2e-status-'));
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-project' }));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('shows "not initialized" when no .wardrc exists', () => {
    const result = execSync(`${RUN} status`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    expect(result).toContain('not initialized');
  });

  it('shows protection summary after init', () => {
    execSync(`${RUN} init`, { cwd: tmpDir, stdio: 'pipe' });
    const result = execSync(`${RUN} status`, {
      cwd: tmpDir,
      encoding: 'utf-8',
    });
    expect(result).toContain('protected');
  });

  it('shows DB age in status', () => {
    execSync(`${RUN} init`, { cwd: tmpDir, stdio: 'pipe' });
    const result = execSync(`${RUN} status`, {
      cwd: tmpDir,
      encoding: 'utf-8',
    });
    expect(result).toMatch(/last sync|never synced/i);
  });
});
