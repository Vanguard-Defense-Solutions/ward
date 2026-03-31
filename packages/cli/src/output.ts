import type { Verdict } from '@ward/shared';

const NO_COLOR = !!process.env.NO_COLOR || process.env.TERM === 'dumb';

const colors = {
  green: (s: string) => NO_COLOR ? s : `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => NO_COLOR ? s : `\x1b[33m${s}\x1b[0m`,
  red: (s: string) => NO_COLOR ? s : `\x1b[31m${s}\x1b[0m`,
  dim: (s: string) => NO_COLOR ? s : `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => NO_COLOR ? s : `\x1b[1m${s}\x1b[0m`,
};

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

export function formatVerdictJson(verdict: Verdict): string {
  return JSON.stringify(verdict);
}

export function formatScanResult(results: { total: number; blocked: number; warned: number; clean: number; verdicts: Verdict[] }, json: boolean): string {
  if (json) {
    return JSON.stringify({ total: results.total, blocked: results.blocked, warned: results.warned, clean: results.clean });
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

export function formatInitSuccess(json: boolean): string {
  if (json) {
    return JSON.stringify({ success: true, message: 'Ward initialized' });
  }
  return colors.green('✓ Ward initialized');
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
    colors.dim(`  Last sync: ${status.dbAge ?? 'never synced'}`),
  ];

  return lines.join('\n');
}
