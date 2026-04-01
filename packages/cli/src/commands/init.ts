import fs from 'fs';
import path from 'path';
import { saveConfig, wardDataDir, dbPath } from '../config';
import { formatInitSuccess } from '../output';
import { seedCommand } from './seed';

export type PackageManager = 'npm' | 'bun' | 'yarn-classic' | 'yarn-berry';

/**
 * Detect which package managers are in use based on lockfiles and config files.
 * Returns a list of detected PMs. Defaults to ['npm'] if none detected.
 */
export function detectPackageManagers(projectDir: string): PackageManager[] {
  const pms: PackageManager[] = [];

  // npm: package-lock.json
  if (fs.existsSync(path.join(projectDir, 'package-lock.json'))) {
    pms.push('npm');
  }

  // bun: bun.lockb or bun.lock
  if (
    fs.existsSync(path.join(projectDir, 'bun.lockb')) ||
    fs.existsSync(path.join(projectDir, 'bun.lock'))
  ) {
    pms.push('bun');
  }

  // yarn: yarn.lock
  if (fs.existsSync(path.join(projectDir, 'yarn.lock'))) {
    // Detect Berry vs Classic by .yarnrc.yml presence
    if (fs.existsSync(path.join(projectDir, '.yarnrc.yml'))) {
      pms.push('yarn-berry');
    } else {
      pms.push('yarn-classic');
    }
  }

  // Default to npm if nothing detected
  if (pms.length === 0) {
    pms.push('npm');
  }

  return pms;
}

function setupNpmrc(projectDir: string): void {
  const npmrcPath = path.join(projectDir, '.npmrc');
  let content = '';
  if (fs.existsSync(npmrcPath)) {
    content = fs.readFileSync(npmrcPath, 'utf-8');
  }
  if (!content.includes('ignore-scripts=true')) {
    content = content.trimEnd() + (content ? '\n' : '') + 'ignore-scripts=true\n';
    fs.writeFileSync(npmrcPath, content);
  }
}

function setupBunfigToml(projectDir: string): void {
  const bunfigPath = path.join(projectDir, 'bunfig.toml');
  let content = '';
  if (fs.existsSync(bunfigPath)) {
    content = fs.readFileSync(bunfigPath, 'utf-8');
  }
  // Check if install.auto is already configured
  if (!content.includes('auto = "disable"')) {
    // If there's already an [install] section, append under it
    if (content.includes('[install]')) {
      content = content.replace(
        /\[install\]/,
        '[install]\nauto = "disable"'
      );
    } else {
      content = content.trimEnd() + (content ? '\n\n' : '') + '[install]\nauto = "disable"\n';
    }
    fs.writeFileSync(bunfigPath, content);
  }
}

function setupYarnBerryRc(projectDir: string): void {
  const yarnrcPath = path.join(projectDir, '.yarnrc.yml');
  let content = '';
  if (fs.existsSync(yarnrcPath)) {
    content = fs.readFileSync(yarnrcPath, 'utf-8');
  }
  if (!content.includes('enableScripts: false')) {
    content = content.trimEnd() + (content ? '\n' : '') + 'enableScripts: false\n';
    fs.writeFileSync(yarnrcPath, content);
  }
}

function setupYarnClassicRc(projectDir: string): void {
  const yarnrcPath = path.join(projectDir, '.yarnrc');
  let content = '';
  if (fs.existsSync(yarnrcPath)) {
    content = fs.readFileSync(yarnrcPath, 'utf-8');
  }
  if (!content.includes('ignore-scripts true')) {
    content = content.trimEnd() + (content ? '\n' : '') + 'ignore-scripts true\n';
    fs.writeFileSync(yarnrcPath, content);
  }
}

function setupPreinstallHook(projectDir: string): void {
  const pkgPath = path.join(projectDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  if (!pkg.scripts) pkg.scripts = {};
  if (!pkg.scripts.preinstall || !pkg.scripts.preinstall.includes('ward')) {
    pkg.scripts.preinstall = 'ward check-install';
  }
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

/**
 * Convert detected PMs to display-friendly labels for output.
 */
export function pmDisplayLabels(pms: PackageManager[]): string[] {
  return pms.map((pm) => {
    switch (pm) {
      case 'npm': return 'npm';
      case 'bun': return 'bun';
      case 'yarn-classic': return 'yarn';
      case 'yarn-berry': return 'yarn';
    }
  });
}

export function initCommand(options: { json?: boolean } = {}): void {
  // init requires package.json in current directory (don't walk up)
  const cwd = process.cwd();
  const projectDir = fs.existsSync(path.join(cwd, 'package.json')) ? cwd : null;

  if (!projectDir) {
    const msg = 'No package.json found — run `ward init` in a Node.js project';
    if (options.json) {
      console.log(JSON.stringify({ success: false, error: msg }));
    } else {
      console.error(msg);
    }
    process.exit(1);
  }

  // Create .wardrc with defaults (only if it doesn't already exist)
  const rcPath = path.join(projectDir, '.wardrc');
  if (!fs.existsSync(rcPath)) {
    saveConfig(projectDir);
  }

  // Create .ward data directory
  wardDataDir(projectDir);

  // Detect package managers
  const pms = detectPackageManagers(projectDir);

  // Configure hooks for each detected package manager
  for (const pm of pms) {
    switch (pm) {
      case 'npm':
        setupNpmrc(projectDir);
        break;
      case 'bun':
        setupBunfigToml(projectDir);
        break;
      case 'yarn-berry':
        setupYarnBerryRc(projectDir);
        break;
      case 'yarn-classic':
        setupYarnClassicRc(projectDir);
        break;
    }
  }

  // Add preinstall hook to package.json (works for all PMs)
  setupPreinstallHook(projectDir);

  // Auto-seed threat DB if empty
  const db = dbPath(projectDir);
  if (!fs.existsSync(db) || fs.statSync(db).size === 0) {
    seedCommand({ silent: true });
  }

  const labels = pmDisplayLabels(pms);
  console.log(formatInitSuccess(!!options.json, labels));
}
