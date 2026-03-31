import fs from 'fs';
import path from 'path';

let cached: string[] | null = null;

export function loadTopPackages(): string[] {
  if (cached) return cached;

  // Look for the data file in @ward/shared
  const candidates = [
    path.resolve(__dirname, '../../shared/data/top-packages.json'),
    path.resolve(__dirname, '../../../packages/shared/data/top-packages.json'),
    path.resolve(__dirname, '../node_modules/@ward/shared/data/top-packages.json'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        cached = JSON.parse(fs.readFileSync(candidate, 'utf-8'));
        return cached!;
      } catch {
        // Fall through to next candidate
      }
    }
  }

  // Fallback: empty list (typosquat detection disabled but nothing breaks)
  cached = [];
  return cached;
}
