import type { Signal, Verdict } from './types';

export type { Signal, Verdict };
export type { SignalSeverity } from './types';

/**
 * Combine signals into a verdict.
 *
 *   SIGNALS ──▶ highest severity wins ──▶ VERDICT
 *     │              │                       │
 *     ▼              ▼                       ▼
 *   [info]       severity=info          action=allow
 *   [warning]    severity=warning       action=warn
 *   [critical]   severity=critical      action=block
 */
export function decideVerdict(signals: Signal[]): Verdict {
  if (signals.length === 0) {
    return { action: 'allow', signals: [], summary: 'clean' };
  }

  const hasCritical = signals.some((s) => s.severity === 'critical');
  const hasWarning = signals.some((s) => s.severity === 'warning');

  if (hasCritical) {
    const criticalSignal = signals.find((s) => s.severity === 'critical')!;
    return {
      action: 'block',
      signals,
      summary: `BLOCKED — ${criticalSignal.message}`,
      explanation: criticalSignal.message,
      safeVersion: criticalSignal.safeVersion,
    };
  }

  if (hasWarning) {
    const warningSignal = signals.find((s) => s.severity === 'warning')!;
    return {
      action: 'warn',
      signals,
      summary: `suspicious — ${warningSignal.message}`,
    };
  }

  return { action: 'allow', signals, summary: 'clean' };
}
