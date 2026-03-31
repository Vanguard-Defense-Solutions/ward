import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CLI_PATH = path.resolve(__dirname, '../../src/index.ts');
const RUN = `npx tsx ${CLI_PATH}`;

describe('E2E: npm hook interception', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ward-e2e-hook-'));
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-project', version: '1.0.0' }));
    // Init ward
    execSync(`${RUN} init`, { cwd: tmpDir, stdio: 'pipe' });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('ward init configures .npmrc with ignore-scripts', () => {
    const npmrc = fs.readFileSync(path.join(tmpDir, '.npmrc'), 'utf-8');
    expect(npmrc).toContain('ignore-scripts=true');
  });

  it('ward init adds a preinstall hook to package.json', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf-8'));
    expect(pkg.scripts?.preinstall).toContain('ward');
  });

  it('ward init preserves existing scripts in package.json', () => {
    // Create a new temp dir with existing scripts
    const tmpDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'ward-e2e-hook2-'));
    fs.writeFileSync(path.join(tmpDir2, 'package.json'), JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      scripts: { test: 'vitest', build: 'tsc' },
    }));
    execSync(`${RUN} init`, { cwd: tmpDir2, stdio: 'pipe' });
    const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir2, 'package.json'), 'utf-8'));
    expect(pkg.scripts.test).toBe('vitest');
    expect(pkg.scripts.build).toBe('tsc');
    expect(pkg.scripts.preinstall).toContain('ward');
    fs.rmSync(tmpDir2, { recursive: true, force: true });
  });
});
