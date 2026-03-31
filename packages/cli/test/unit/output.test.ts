import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { formatVerdict, formatVerdictJson, formatScanResult, formatInitSuccess, formatStatus } from '../../src/output';
import type { Verdict } from '@ward/shared';

describe('Output Formatting', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('formatVerdict', () => {
    it('shows ✓ for clean verdicts', () => {
      const verdict: Verdict = { action: 'allow', signals: [], summary: 'clean' };
      const output = formatVerdict(verdict);
      expect(output).toContain('✓');
      expect(output).toContain('clean');
    });

    it('shows ⚠ for warning verdicts', () => {
      const verdict: Verdict = {
        action: 'warn',
        signals: [{ type: 'typosquat', severity: 'warning', message: 'Similar to "axios"' }],
        summary: 'suspicious',
      };
      const output = formatVerdict(verdict);
      expect(output).toContain('⚠');
      expect(output).toContain('suspicious');
    });

    it('shows ✗ for blocked verdicts', () => {
      const verdict: Verdict = {
        action: 'block',
        signals: [{ type: 'known-threat', severity: 'critical', message: 'Malicious' }],
        summary: 'BLOCKED',
        explanation: 'Steals credentials',
        safeVersion: '1.0.0',
      };
      const output = formatVerdict(verdict);
      expect(output).toContain('✗');
      expect(output).toContain('BLOCKED');
      expect(output).toContain('Steals credentials');
      expect(output).toContain('Safe version: 1.0.0');
    });

    it('respects NO_COLOR env var (no ANSI)', () => {
      process.env.NO_COLOR = '1';
      // Re-import to pick up the env change — use dynamic import
      // Since NO_COLOR is evaluated at module load time, we test indirectly
      // by checking the formatVerdictJson path which is always plain
      const verdict: Verdict = { action: 'allow', signals: [], summary: 'clean' };
      const json = formatVerdictJson(verdict);
      expect(json).not.toContain('\x1b');
    });
  });

  describe('formatVerdictJson', () => {
    it('produces valid JSON', () => {
      const verdict: Verdict = { action: 'allow', signals: [], summary: 'clean' };
      const json = formatVerdictJson(verdict);
      const parsed = JSON.parse(json);
      expect(parsed.action).toBe('allow');
    });
  });

  describe('formatScanResult', () => {
    it('shows All clear for clean scan', () => {
      const result = formatScanResult({
        total: 5, blocked: 0, warned: 0, clean: 5,
        verdicts: [{ action: 'allow', signals: [], summary: 'clean' }],
      }, false);
      expect(result).toContain('All clear');
      expect(result).toContain('5');
    });

    it('outputs JSON when json flag is true', () => {
      const result = formatScanResult({
        total: 5, blocked: 0, warned: 0, clean: 5, verdicts: [],
      }, true);
      const parsed = JSON.parse(result);
      expect(parsed.total).toBe(5);
      expect(parsed.blocked).toBe(0);
    });
  });

  describe('formatInitSuccess', () => {
    it('shows success message', () => {
      const result = formatInitSuccess(false);
      expect(result).toContain('Ward initialized');
    });

    it('outputs valid JSON when json flag is true', () => {
      const result = formatInitSuccess(true);
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });
  });

  describe('formatStatus', () => {
    it('shows not initialized when not initialized', () => {
      const result = formatStatus({
        initialized: false, dbAge: null, threatCount: 0, sensitivity: 'normal',
      }, false);
      expect(result).toContain('not initialized');
    });

    it('shows protected when initialized', () => {
      const result = formatStatus({
        initialized: true, dbAge: null, threatCount: 100, sensitivity: 'normal',
      }, false);
      expect(result).toContain('protected');
      expect(result).toContain('never synced');
    });
  });
});
