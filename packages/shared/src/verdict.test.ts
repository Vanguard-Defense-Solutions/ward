import { describe, it, expect } from 'vitest';
import { Verdict, Signal, SignalSeverity, decideVerdict } from './verdict';

describe('Verdict System', () => {
  // Unit tests — pure function behavior
  describe('decideVerdict', () => {
    it('returns CLEAN when no signals', () => {
      expect(decideVerdict([])).toEqual({
        action: 'allow',
        signals: [],
        summary: 'clean',
      });
    });

    it('returns CLEAN when all signals are info', () => {
      const signals: Signal[] = [
        { type: 'install-script', severity: 'info', message: 'Has postinstall script' },
      ];
      expect(decideVerdict(signals).action).toBe('allow');
    });

    it('returns WARN when any signal is warning', () => {
      const signals: Signal[] = [
        { type: 'typosquat', severity: 'warning', message: 'Similar to "axios"' },
      ];
      const verdict = decideVerdict(signals);
      expect(verdict.action).toBe('warn');
      expect(verdict.summary).toContain('suspicious');
    });

    it('returns BLOCK when any signal is critical', () => {
      const signals: Signal[] = [
        { type: 'known-threat', severity: 'critical', message: 'Known malicious package' },
      ];
      const verdict = decideVerdict(signals);
      expect(verdict.action).toBe('block');
      expect(verdict.summary).toContain('BLOCKED');
    });

    it('BLOCK overrides WARN when both present', () => {
      const signals: Signal[] = [
        { type: 'typosquat', severity: 'warning', message: 'Similar to "lodash"' },
        { type: 'known-threat', severity: 'critical', message: 'Known malicious' },
      ];
      expect(decideVerdict(signals).action).toBe('block');
    });

    it('includes all signals in verdict regardless of severity', () => {
      const signals: Signal[] = [
        { type: 'install-script', severity: 'info', message: 'Has preinstall' },
        { type: 'typosquat', severity: 'warning', message: 'Similar to "express"' },
      ];
      expect(decideVerdict(signals).signals).toHaveLength(2);
    });

    it('provides safe version suggestion when available', () => {
      const signals: Signal[] = [
        {
          type: 'known-threat',
          severity: 'critical',
          message: 'Malicious RAT dropper',
          safeVersion: '1.14.0',
        },
      ];
      const verdict = decideVerdict(signals);
      expect(verdict.safeVersion).toBe('1.14.0');
    });

    it('provides human-readable explanation for blocks', () => {
      const signals: Signal[] = [
        {
          type: 'known-threat',
          severity: 'critical',
          message: 'This version steals SSH keys and cloud credentials',
        },
      ];
      const verdict = decideVerdict(signals);
      expect(verdict.explanation).toContain('SSH keys');
    });
  });
});
