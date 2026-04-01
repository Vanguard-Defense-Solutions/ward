import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CLI_PATH = path.resolve(__dirname, '../../src/index.ts');
const RUN = `bun ${CLI_PATH}`;

describe('E2E: package manager hook setup', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ward-e2e-pm-'));
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-project', version: '1.0.0' }));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('bun hooks', () => {
    it('creates bunfig.toml when bun.lockb exists', () => {
      fs.writeFileSync(path.join(tmpDir, 'bun.lockb'), '');
      execSync(`${RUN} init`, { cwd: tmpDir, stdio: 'pipe' });

      const bunfig = fs.readFileSync(path.join(tmpDir, 'bunfig.toml'), 'utf-8');
      expect(bunfig).toContain('[install]');
      expect(bunfig).toContain('auto = "disable"');
    });

    it('creates bunfig.toml when bun.lock exists', () => {
      fs.writeFileSync(path.join(tmpDir, 'bun.lock'), '');
      execSync(`${RUN} init`, { cwd: tmpDir, stdio: 'pipe' });

      const bunfig = fs.readFileSync(path.join(tmpDir, 'bunfig.toml'), 'utf-8');
      expect(bunfig).toContain('[install]');
      expect(bunfig).toContain('auto = "disable"');
    });

    it('adds preinstall hook to package.json for bun projects', () => {
      fs.writeFileSync(path.join(tmpDir, 'bun.lockb'), '');
      execSync(`${RUN} init`, { cwd: tmpDir, stdio: 'pipe' });

      const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf-8'));
      expect(pkg.scripts?.preinstall).toContain('ward');
    });

    it('does not create .npmrc when only bun is detected', () => {
      fs.writeFileSync(path.join(tmpDir, 'bun.lockb'), '');
      execSync(`${RUN} init`, { cwd: tmpDir, stdio: 'pipe' });

      expect(fs.existsSync(path.join(tmpDir, '.npmrc'))).toBe(false);
    });

    it('preserves existing bunfig.toml content', () => {
      fs.writeFileSync(path.join(tmpDir, 'bun.lockb'), '');
      fs.writeFileSync(path.join(tmpDir, 'bunfig.toml'), '[test]\npreload = ["./setup.ts"]\n');
      execSync(`${RUN} init`, { cwd: tmpDir, stdio: 'pipe' });

      const bunfig = fs.readFileSync(path.join(tmpDir, 'bunfig.toml'), 'utf-8');
      expect(bunfig).toContain('[test]');
      expect(bunfig).toContain('preload');
      expect(bunfig).toContain('auto = "disable"');
    });

    it('shows bun in init output', () => {
      fs.writeFileSync(path.join(tmpDir, 'bun.lockb'), '');
      const result = execSync(`${RUN} init`, { cwd: tmpDir, encoding: 'utf-8' });
      expect(result).toContain('bun');
      expect(result).toContain('Ward initialized');
    });
  });

  describe('yarn classic hooks', () => {
    it('creates .yarnrc when yarn.lock exists without .yarnrc.yml', () => {
      fs.writeFileSync(path.join(tmpDir, 'yarn.lock'), '');
      execSync(`${RUN} init`, { cwd: tmpDir, stdio: 'pipe' });

      const yarnrc = fs.readFileSync(path.join(tmpDir, '.yarnrc'), 'utf-8');
      expect(yarnrc).toContain('ignore-scripts true');
    });

    it('adds preinstall hook to package.json for yarn classic projects', () => {
      fs.writeFileSync(path.join(tmpDir, 'yarn.lock'), '');
      execSync(`${RUN} init`, { cwd: tmpDir, stdio: 'pipe' });

      const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf-8'));
      expect(pkg.scripts?.preinstall).toContain('ward');
    });

    it('shows yarn in init output', () => {
      fs.writeFileSync(path.join(tmpDir, 'yarn.lock'), '');
      const result = execSync(`${RUN} init`, { cwd: tmpDir, encoding: 'utf-8' });
      expect(result).toContain('yarn');
      expect(result).toContain('Ward initialized');
    });
  });

  describe('yarn berry hooks', () => {
    it('updates .yarnrc.yml with enableScripts: false when yarn.lock + .yarnrc.yml exist', () => {
      fs.writeFileSync(path.join(tmpDir, 'yarn.lock'), '');
      fs.writeFileSync(path.join(tmpDir, '.yarnrc.yml'), 'nodeLinker: node-modules\n');
      execSync(`${RUN} init`, { cwd: tmpDir, stdio: 'pipe' });

      const yarnrc = fs.readFileSync(path.join(tmpDir, '.yarnrc.yml'), 'utf-8');
      expect(yarnrc).toContain('enableScripts: false');
      expect(yarnrc).toContain('nodeLinker: node-modules');
    });

    it('does not create .yarnrc for berry projects', () => {
      fs.writeFileSync(path.join(tmpDir, 'yarn.lock'), '');
      fs.writeFileSync(path.join(tmpDir, '.yarnrc.yml'), 'nodeLinker: node-modules\n');
      execSync(`${RUN} init`, { cwd: tmpDir, stdio: 'pipe' });

      expect(fs.existsSync(path.join(tmpDir, '.yarnrc'))).toBe(false);
    });
  });

  describe('multiple package managers', () => {
    it('configures hooks for all detected PMs', () => {
      fs.writeFileSync(path.join(tmpDir, 'package-lock.json'), '{}');
      fs.writeFileSync(path.join(tmpDir, 'bun.lockb'), '');
      fs.writeFileSync(path.join(tmpDir, 'yarn.lock'), '');
      execSync(`${RUN} init`, { cwd: tmpDir, stdio: 'pipe' });

      // npm hook
      const npmrc = fs.readFileSync(path.join(tmpDir, '.npmrc'), 'utf-8');
      expect(npmrc).toContain('ignore-scripts=true');

      // bun hook
      const bunfig = fs.readFileSync(path.join(tmpDir, 'bunfig.toml'), 'utf-8');
      expect(bunfig).toContain('auto = "disable"');

      // yarn classic hook (no .yarnrc.yml)
      const yarnrc = fs.readFileSync(path.join(tmpDir, '.yarnrc'), 'utf-8');
      expect(yarnrc).toContain('ignore-scripts true');

      // preinstall in package.json
      const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf-8'));
      expect(pkg.scripts?.preinstall).toContain('ward');
    });

    it('shows all PMs in init output', () => {
      fs.writeFileSync(path.join(tmpDir, 'package-lock.json'), '{}');
      fs.writeFileSync(path.join(tmpDir, 'bun.lockb'), '');
      const result = execSync(`${RUN} init`, { cwd: tmpDir, encoding: 'utf-8' });
      expect(result).toContain('npm');
      expect(result).toContain('bun');
      expect(result).toContain('Ward initialized');
    });

    it('shows all PMs in JSON output', () => {
      fs.writeFileSync(path.join(tmpDir, 'package-lock.json'), '{}');
      fs.writeFileSync(path.join(tmpDir, 'bun.lockb'), '');
      const result = execSync(`${RUN} init --json`, { cwd: tmpDir, encoding: 'utf-8' });
      const parsed = JSON.parse(result.trim());
      expect(parsed.success).toBe(true);
      expect(parsed.packageManagers).toContain('npm');
      expect(parsed.packageManagers).toContain('bun');
    });
  });

  describe('re-init idempotency', () => {
    it('does not duplicate bunfig.toml config on re-init', () => {
      fs.writeFileSync(path.join(tmpDir, 'bun.lockb'), '');
      execSync(`${RUN} init`, { cwd: tmpDir, stdio: 'pipe' });
      execSync(`${RUN} init`, { cwd: tmpDir, stdio: 'pipe' });

      const bunfig = fs.readFileSync(path.join(tmpDir, 'bunfig.toml'), 'utf-8');
      const matches = bunfig.match(/auto = "disable"/g);
      expect(matches).toHaveLength(1);
    });

    it('does not duplicate .yarnrc config on re-init', () => {
      fs.writeFileSync(path.join(tmpDir, 'yarn.lock'), '');
      execSync(`${RUN} init`, { cwd: tmpDir, stdio: 'pipe' });
      execSync(`${RUN} init`, { cwd: tmpDir, stdio: 'pipe' });

      const yarnrc = fs.readFileSync(path.join(tmpDir, '.yarnrc'), 'utf-8');
      const matches = yarnrc.match(/ignore-scripts true/g);
      expect(matches).toHaveLength(1);
    });

    it('does not duplicate .yarnrc.yml config on re-init', () => {
      fs.writeFileSync(path.join(tmpDir, 'yarn.lock'), '');
      fs.writeFileSync(path.join(tmpDir, '.yarnrc.yml'), 'nodeLinker: node-modules\n');
      execSync(`${RUN} init`, { cwd: tmpDir, stdio: 'pipe' });
      execSync(`${RUN} init`, { cwd: tmpDir, stdio: 'pipe' });

      const yarnrc = fs.readFileSync(path.join(tmpDir, '.yarnrc.yml'), 'utf-8');
      const matches = yarnrc.match(/enableScripts: false/g);
      expect(matches).toHaveLength(1);
    });

    it('does not duplicate preinstall hook on re-init', () => {
      fs.writeFileSync(path.join(tmpDir, 'bun.lockb'), '');
      execSync(`${RUN} init`, { cwd: tmpDir, stdio: 'pipe' });
      execSync(`${RUN} init`, { cwd: tmpDir, stdio: 'pipe' });

      const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf-8'));
      // Should still just be "ward check-install", not duplicated
      expect(pkg.scripts.preinstall).toBe('ward check-install');
    });
  });

  describe('default behavior', () => {
    it('defaults to npm hooks when no lockfile exists', () => {
      execSync(`${RUN} init`, { cwd: tmpDir, stdio: 'pipe' });

      const npmrc = fs.readFileSync(path.join(tmpDir, '.npmrc'), 'utf-8');
      expect(npmrc).toContain('ignore-scripts=true');
      expect(fs.existsSync(path.join(tmpDir, 'bunfig.toml'))).toBe(false);
      expect(fs.existsSync(path.join(tmpDir, '.yarnrc'))).toBe(false);
    });

    it('shows npm in output when defaulting', () => {
      const result = execSync(`${RUN} init`, { cwd: tmpDir, encoding: 'utf-8' });
      expect(result).toContain('npm');
      expect(result).toContain('Ward initialized');
    });
  });
});
