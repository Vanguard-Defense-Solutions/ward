export type SignalType =
  | 'known-threat'
  | 'typosquat'
  | 'install-script'
  | 'version-anomaly'
  | 'maintainer-change';

export type SignalSeverity = 'info' | 'warning' | 'critical';

export interface Signal {
  type: SignalType;
  severity: SignalSeverity;
  message: string;
  safeVersion?: string;
  details?: Record<string, unknown>;
}

export interface Verdict {
  action: 'allow' | 'warn' | 'block';
  summary: string;
  explanation?: string;
  signals: Signal[];
  safeVersion?: string;
}

export interface PackageQuery {
  name: string;
  version: string;
}

export interface ThreatEntry {
  package_name: string;
  version: string;
  threat_type: string;
  description: string;
  safe_version?: string;
  detected_at: string;
}

export interface WardConfig {
  sensitivity: 'strict' | 'normal' | 'permissive';
  allowlist: string[];
  cloudEnabled: boolean;
  cloudUrl?: string;
}

export const DEFAULT_CONFIG: WardConfig = {
  sensitivity: 'normal',
  allowlist: [],
  cloudEnabled: true,
  cloudUrl: 'https://api.wardshield.com',
};
