import fs from 'fs';
import path from 'path';
import { saveConfig, wardDataDir } from '../config';
import { formatInitSuccess } from '../output';

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

  console.log(formatInitSuccess(!!options.json));
}
