import type { Signal } from '../types';

const INSTALL_HOOKS = ['preinstall', 'install', 'postinstall', 'preuninstall'];

const KNOWN_SAFE_PATTERNS = [
  /^node-gyp\s+rebuild$/,
  /^prebuild-install\b/,
  /^node\s+install\.js$/,
  /^patch-package$/,
  /^husky\b/,
  /^ngcc\b/,
  /^opencollective\b/,
];

function isKnownSafe(script: string): boolean {
  return KNOWN_SAFE_PATTERNS.some((pattern) => pattern.test(script.trim()));
}

export function checkInstallScripts(scripts: Record<string, string> | undefined | null): Signal | null {
  if (!scripts || typeof scripts !== 'object') return null;

  const foundHooks: string[] = [];
  let allKnownSafe = true;

  for (const hook of INSTALL_HOOKS) {
    if (scripts[hook]) {
      foundHooks.push(hook);
      if (!isKnownSafe(scripts[hook])) {
        allKnownSafe = false;
      }
    }
  }

  if (foundHooks.length === 0) return null;

  const hookList = foundHooks.join(', ');

  return {
    type: 'install-script',
    severity: allKnownSafe ? 'info' : 'warning',
    message: `Has install hooks: ${hookList}`,
    details: {
      hooks: foundHooks,
      scripts: Object.fromEntries(foundHooks.map((h) => [h, scripts[h]])),
    },
  };
}
