import fs from 'fs';
import path from 'path';
import type { WardConfig } from '@ward/shared';
import { DEFAULT_CONFIG } from '@ward/shared';

export function findProjectRoot(startDir: string): string | null {
  let dir = startDir;
  while (true) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function loadConfig(projectDir: string): WardConfig {
  const rcPath = path.join(projectDir, '.wardrc');
  if (!fs.existsSync(rcPath)) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const raw = fs.readFileSync(rcPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch (err) {
    throw new Error(`Invalid .wardrc: ${(err as Error).message}`);
  }
}

export function saveConfig(projectDir: string, config: Partial<WardConfig> = {}): void {
  const rcPath = path.join(projectDir, '.wardrc');
  const merged = { ...DEFAULT_CONFIG, ...config };
  fs.writeFileSync(rcPath, JSON.stringify(merged, null, 2) + '\n');
}

export function wardDataDir(projectDir: string): string {
  const dir = path.join(projectDir, '.ward');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function dbPath(projectDir: string): string {
  return path.join(wardDataDir(projectDir), 'threats.db');
}
