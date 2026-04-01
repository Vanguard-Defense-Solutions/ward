import type { Verdict } from '@ward/shared';

function isNoColor(): boolean {
  return !!process.env.NO_COLOR || process.env.TERM === 'dumb';
}

const colors = {
  green: (s: string) => isNoColor() ? s : `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => isNoColor() ? s : `\x1b[33m${s}\x1b[0m`,
  red: (s: string) => isNoColor() ? s : `\x1b[31m${s}\x1b[0m`,
  dim: (s: string) => isNoColor() ? s : `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => isNoColor() ? s : `\x1b[1m${s}\x1b[0m`,
};

export function timeAgo(isoString: string | null): string {
  if (!isoString) return 'never synced';

  const then = new Date(isoString).getTime();
  if (isNaN(then)) return 'never synced';

  const now = Date.now();
  const diffMs = now - then;

  // Future or negative timestamps
  if (diffMs < 0) return 'just now';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

export function formatVerdict(verdict: Verdict): string {
  switch (verdict.action) {
    case 'allow':
      return colors.green(colors.bold('✓ ward: clean'));
    case 'warn': {
      const lines = [colors.yellow(colors.bold('⚠ ward: suspicious'))];
      for (const signal of verdict.signals) {
        if (signal.severity === 'warning' || signal.severity === 'critical') {
          lines.push(colors.dim(`  ${signal.message}`));
        }
      }
      return lines.join('\n');
    }
    case 'block': {
      const lines = [colors.red(colors.bold('✗ ward: BLOCKED'))];
      if (verdict.explanation) {
        lines.push(colors.dim(`  ${verdict.explanation}`));
      }
      if (verdict.safeVersion) {
        lines.push(colors.green(`  Safe version: ${verdict.safeVersion}`));
      }
      return lines.join('\n');
    }
  }
}

export interface VerdictDisplayOptions {
  clinical?: boolean;
  verbose?: boolean;
  packageName?: string;
  packageVersion?: string;
  checkTimeMs?: number;
  checksRan?: string[];
}

export function formatVerdictClinical(verdict: Verdict, opts: VerdictDisplayOptions = {}): string {
  const pkg = opts.packageName && opts.packageVersion
    ? `${opts.packageName}@${opts.packageVersion}`
    : 'unknown';
  const threatType = verdict.signals.length > 0 ? verdict.signals[0].type : 'none';
  const safeStr = verdict.safeVersion ? ` — Safe: ${verdict.safeVersion}` : '';
  return `${pkg} — ${threatType} — ${verdict.action}${safeStr}`;
}

export function formatVerdictVerbose(verdict: Verdict, opts: VerdictDisplayOptions = {}): string {
  const base = formatVerdict(verdict);
  const lines = [base];

  const score = verdict.action === 'allow' ? 100 : verdict.action === 'warn' ? 50 : 0;
  lines.push(colors.dim(`  Ward Score: ${score}/100`));

  if (opts.checksRan && opts.checksRan.length > 0) {
    lines.push(colors.dim(`  Checked: ${opts.checksRan.join(', ')}`));
  } else {
    lines.push(colors.dim('  Checked: threat-db, typosquat, install-scripts'));
  }

  if (opts.checkTimeMs !== undefined) {
    lines.push(colors.dim(`  Check time: ${opts.checkTimeMs}ms`));
  }

  return lines.join('\n');
}

export function formatVerdictJson(verdict: Verdict): string {
  return JSON.stringify(verdict);
}

export function formatScanResult(results: { total: number; blocked: number; warned: number; clean: number; verdicts: Verdict[] }, json: boolean): string {
  if (json) {
    return JSON.stringify({ total: results.total, blocked: results.blocked, warned: results.warned, clean: results.clean, verdicts: results.verdicts });
  }

  const lines: string[] = [];
  for (const v of results.verdicts) {
    if (v.action !== 'allow') {
      lines.push(formatVerdict(v));
    }
  }

  if (results.blocked === 0 && results.warned === 0) {
    lines.push(colors.green(`✓ All clear — ${results.total} dependencies checked`));
  } else {
    lines.push(colors.dim(`${results.total} checked, ${results.blocked} blocked, ${results.warned} warned`));
  }

  return lines.join('\n');
}

export function formatInitSuccess(json: boolean, packageManagers?: string[]): string {
  const pmSuffix = packageManagers && packageManagers.length > 0
    ? ` (${packageManagers.join(' + ')})`
    : '';
  if (json) {
    return JSON.stringify({
      success: true,
      message: `Ward initialized${pmSuffix}`,
      ...(packageManagers ? { packageManagers } : {}),
    });
  }
  return colors.green(`✓ Ward initialized${pmSuffix}`);
}

export function formatStatus(status: { initialized: boolean; dbAge: string | null; threatCount: number; sensitivity: string }, json: boolean): string {
  if (json) {
    return JSON.stringify(status);
  }

  if (!status.initialized) {
    return colors.yellow('⚠ Ward is not initialized — run `ward init`');
  }

  const lines = [
    colors.green(colors.bold('✓ Project protected by Ward')),
    colors.dim(`  Sensitivity: ${status.sensitivity}`),
    colors.dim(`  Threats in DB: ${status.threatCount}`),
    colors.dim(`  Last sync: ${timeAgo(status.dbAge)}`),
  ];

  return lines.join('\n');
}
