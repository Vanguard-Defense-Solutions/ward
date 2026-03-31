import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CLI_PATH = path.resolve(__dirname, '../../src/index.ts');
const RUN = `bun ${CLI_PATH}`;

describe('E2E: Full Ward workflow', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ward-e2e-full-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('init → scan clean deps → all clear', () => {
    // 1. Create project
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      dependencies: { express: '^4.19.0', lodash: '^4.17.21' },
    }));
    fs.writeFileSync(path.join(tmpDir, 'package-lock.json'), JSON.stringify({
      name: 'test-project',
      lockfileVersion: 3,
      packages: {
        'node_modules/express': { version: '4.19.0' },
        'node_modules/lodash': { version: '4.17.21' },
      },
    }));

    // 2. Init ward
    const initResult = execSync(`${RUN} init`, { cwd: tmpDir, encoding: 'utf-8' });
    expect(initResult).toContain('Ward initialized');

    // 3. Verify artifacts
    expect(fs.existsSync(path.join(tmpDir, '.wardrc'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.npmrc'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.ward'))).toBe(true);

    // 4. Scan
    const scanResult = execSync(`${RUN} scan`, { cwd: tmpDir, encoding: 'utf-8' });
    expect(scanResult).toContain('All clear');
    expect(scanResult).toContain('2');
  });

  it('init → scan with JSON → machine-readable output', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test-project',
      dependencies: { react: '^18.0.0' },
    }));
    fs.writeFileSync(path.join(tmpDir, 'package-lock.json'), JSON.stringify({
      name: 'test-project',
      lockfileVersion: 3,
      packages: {
        'node_modules/react': { version: '18.2.0' },
      },
    }));

    execSync(`${RUN} init`, { cwd: tmpDir, stdio: 'pipe' });

    const scanResult = execSync(`${RUN} scan --json`, { cwd: tmpDir, encoding: 'utf-8' });
    const parsed = JSON.parse(scanResult.trim());
    expect(parsed.total).toBe(1);
    expect(parsed.blocked).toBe(0);
    expect(parsed.clean).toBe(1);
  });

  it('init → status → shows protected', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-project' }));

    execSync(`${RUN} init`, { cwd: tmpDir, stdio: 'pipe' });

    const statusResult = execSync(`${RUN} status`, { cwd: tmpDir, encoding: 'utf-8' });
    expect(statusResult).toContain('protected');
    expect(statusResult).toContain('never synced');
  });

  it('status without init → shows not initialized', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-project' }));

    const result = execSync(`${RUN} status`, { cwd: tmpDir, encoding: 'utf-8', stdio: 'pipe' });
    expect(result).toContain('not initialized');
  });

  it('scan with no lockfile → reports 0 dependencies', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test-project',
      dependencies: { express: '^4.19.0' },
    }));

    execSync(`${RUN} init`, { cwd: tmpDir, stdio: 'pipe' });

    const scanResult = execSync(`${RUN} scan --json`, { cwd: tmpDir, encoding: 'utf-8' });
    const parsed = JSON.parse(scanResult.trim());
    expect(parsed.total).toBe(0);
  });

  it('init is idempotent across the full flow', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test-project',
      scripts: { test: 'vitest' },
    }));

    // First init
    execSync(`${RUN} init`, { cwd: tmpDir, stdio: 'pipe' });
    const pkg1 = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf-8'));
    expect(pkg1.scripts.test).toBe('vitest');
    expect(pkg1.scripts.preinstall).toContain('ward');

    // Second init — should not duplicate or corrupt
    execSync(`${RUN} init`, { cwd: tmpDir, stdio: 'pipe' });
    const pkg2 = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf-8'));
    expect(pkg2.scripts.test).toBe('vitest');
    expect(pkg2.scripts.preinstall).toBe('ward check-install');

    // .npmrc should not have duplicate entries
    const npmrc = fs.readFileSync(path.join(tmpDir, '.npmrc'), 'utf-8');
    const occurrences = npmrc.split('ignore-scripts=true').length - 1;
    expect(occurrences).toBe(1);
  });
});
