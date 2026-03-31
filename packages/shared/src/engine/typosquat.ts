import type { Signal } from '../types';

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

function stripScope(name: string): string {
  return name.startsWith('@') ? name.split('/').slice(1).join('/') : name;
}

function normalize(name: string): string {
  // Strip scope, normalize separators
  return stripScope(name).replace(/[_]/g, '-').toLowerCase();
}

export function checkTyposquat(packageName: string, topPackages: string[]): Signal | null {
  if (topPackages.length === 0) return null;

  const stripped = stripScope(packageName).toLowerCase();
  const normalized = normalize(packageName);

  // Don't check very short names (too many false positives)
  if (normalized.length <= 3) return null;

  const normalizedTop = topPackages.map((p) => ({ original: p, raw: stripScope(p).toLowerCase(), normalized: normalize(p) }));

  // Exact raw match = legitimate (both raw name and normalized must match)
  if (normalizedTop.some((p) => p.raw === stripped)) return null;

  // Separator confusion: raw names differ but normalized names match (e.g. my_package vs my-package)
  const separatorMatch = normalizedTop.find((p) => p.normalized === normalized && p.raw !== stripped);
  if (separatorMatch) {
    return {
      type: 'typosquat',
      severity: 'warning',
      message: `Looks similar to "${separatorMatch.original}" — did you mean "${separatorMatch.original}"?`,
      details: { closestMatch: separatorMatch.original, distance: 0 },
    };
  }

  // Find closest match within distance threshold
  let closest: { original: string; distance: number } | null = null;

  for (const pkg of normalizedTop) {
    // Skip if length difference is too large (can't be within threshold)
    if (Math.abs(pkg.normalized.length - normalized.length) > 2) continue;

    const dist = levenshtein(normalized, pkg.normalized);
    const threshold = pkg.normalized.length <= 4 ? 1 : 2;

    if (dist > 0 && dist <= threshold) {
      if (!closest || dist < closest.distance) {
        closest = { original: pkg.original, distance: dist };
      }
    }
  }

  if (!closest) return null;

  return {
    type: 'typosquat',
    severity: 'warning',
    message: `Looks similar to "${closest.original}" — did you mean "${closest.original}"?`,
    details: { closestMatch: closest.original, distance: closest.distance },
  };
}
