import { ThreatDB } from './threat-db';
import { checkTyposquat } from './typosquat';
import { checkInstallScripts } from './install-script';
import { checkVersionAnomaly } from './version-anomaly';
import { decideVerdict } from '../verdict';
import type { Signal, Verdict, ThreatEntry, WardConfig, PackageQuery } from '../types';
import { DEFAULT_CONFIG } from '../types';

export interface EngineOptions {
  dbPath: string;
  topPackages: string[];
  config?: Partial<WardConfig>;
}

export interface PackageCheckInput extends PackageQuery {
  scripts?: Record<string, string>;
  previousVersion?: string | null;
  registryExists?: boolean;
}

export class LocalEngine {
  private db: ThreatDB;
  private topPackages: string[];
  private config: WardConfig;

  constructor(options: EngineOptions) {
    this.db = new ThreatDB(options.dbPath);
    this.topPackages = options.topPackages;
    this.config = { ...DEFAULT_CONFIG, ...options.config };
  }

  check(input: PackageCheckInput): Verdict {
    // Allowlist bypass
    if (this.config.allowlist.includes(input.name)) {
      return { action: 'allow', signals: [], summary: 'clean (allowlisted)' };
    }

    const signals: Signal[] = [];

    // 1. Known threat check (highest priority)
    const threatSignal = this.db.lookup(input.name, input.version);
    if (threatSignal) signals.push(threatSignal);

    // 2. Typosquat check
    const typoSignal = checkTyposquat(input.name, this.topPackages);
    if (typoSignal) signals.push(typoSignal);

    // 3. Install script check
    if (input.scripts) {
      const scriptSignal = checkInstallScripts(input.scripts);
      if (scriptSignal) signals.push(scriptSignal);
    }

    // 4. Version anomaly check
    const versionSignal = checkVersionAnomaly(
      input.name,
      input.version,
      input.previousVersion ?? null,
      input.registryExists !== undefined ? { exists: input.registryExists } : undefined
    );
    if (versionSignal) signals.push(versionSignal);

    // Apply sensitivity
    const adjustedSignals = this.applySensitivity(signals);

    return decideVerdict(adjustedSignals);
  }

  private applySensitivity(signals: Signal[]): Signal[] {
    if (this.config.sensitivity === 'strict') {
      // Warnings become critical (block)
      return signals.map((s) =>
        s.severity === 'warning' ? { ...s, severity: 'critical' as const } : s
      );
    }
    if (this.config.sensitivity === 'permissive') {
      // Warnings become info (allow) — only critical blocks
      return signals.map((s) =>
        s.severity === 'warning' ? { ...s, severity: 'info' as const } : s
      );
    }
    return signals;
  }

  seedThreat(entry: ThreatEntry): void {
    this.db.insertThreat(entry);
  }

  getDB(): ThreatDB {
    return this.db;
  }

  close(): void {
    this.db.close();
  }
}

export { ThreatDB } from './threat-db';
export { checkTyposquat } from './typosquat';
export { checkInstallScripts } from './install-script';
export { checkVersionAnomaly } from './version-anomaly';
