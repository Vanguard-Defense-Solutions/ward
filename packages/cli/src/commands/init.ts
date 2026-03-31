import fs from 'fs';
import path from 'path';
import { saveConfig, wardDataDir } from '../config';
import { formatInitSuccess } from '../output';

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

function setupPreinstallHook(projectDir: string): void {
  const pkgPath = path.join(projectDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  if (!pkg.scripts) pkg.scripts = {};
  if (!pkg.scripts.preinstall || !pkg.scripts.preinstall.includes('ward')) {
    pkg.scripts.preinstall = 'ward check-install';
  }
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
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

  // Create .wardrc with defaults
  saveConfig(projectDir);

  // Create .ward data directory
  wardDataDir(projectDir);

  // Configure npm to ignore scripts (ward handles them)
  setupNpmrc(projectDir);

  // Add preinstall hook to package.json
  setupPreinstallHook(projectDir);

  console.log(formatInitSuccess(!!options.json));
}
