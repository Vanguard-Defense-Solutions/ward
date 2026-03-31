import type { Signal } from '../types';

function parseMajor(version: string): number | null {
  const match = version.match(/^(\d+)\./);
  return match ? parseInt(match[1], 10) : null;
}

export function checkVersionAnomaly(
  packageName: string,
  version: string,
  previousVersion: string | null,
  options?: { exists?: boolean }
): Signal | null {
  // Flag non-existent versions
  if (options?.exists === false) {
    return {
      type: 'version-anomaly',
      severity: 'warning',
      message: `${packageName}@${version} not found in registry`,
    };
  }

  if (!previousVersion) return null;

  const currentMajor = parseMajor(version);
  const prevMajor = parseMajor(previousVersion);

  if (currentMajor === null || prevMajor === null) return null;

  // Flag suspicious major jumps (more than 1 major version)
  const jump = currentMajor - prevMajor;
  if (jump > 1) {
    return {
      type: 'version-anomaly',
      severity: 'warning',
      message: `Unexpected major version jump: ${previousVersion} → ${version} (${jump} major versions)`,
    };
  }

  return null;
}
