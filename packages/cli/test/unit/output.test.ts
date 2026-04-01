import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatVerdict, formatVerdictJson, formatScanResult, formatInitSuccess, formatStatus, timeAgo, formatVerdictClinical, formatVerdictVerbose } from '../../src/output';
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

    it('respects NO_COLOR env var (no ANSI in formatVerdict)', () => {
      process.env.NO_COLOR = '1';
      const verdict: Verdict = { action: 'allow', signals: [], summary: 'clean' };
      const output = formatVerdict(verdict);
      expect(output).not.toContain('\x1b');
      expect(output).toContain('clean');
    });

    it('respects NO_COLOR for warning verdicts', () => {
      process.env.NO_COLOR = '1';
      const verdict: Verdict = {
        action: 'warn',
        signals: [{ type: 'typosquat', severity: 'warning', message: 'Similar to "axios"' }],
        summary: 'suspicious',
      };
      const output = formatVerdict(verdict);
      expect(output).not.toContain('\x1b');
      expect(output).toContain('suspicious');
    });

    it('respects NO_COLOR for blocked verdicts', () => {
      process.env.NO_COLOR = '1';
      const verdict: Verdict = {
        action: 'block',
        signals: [{ type: 'known-threat', severity: 'critical', message: 'Malicious' }],
        summary: 'BLOCKED',
        explanation: 'Steals credentials',
        safeVersion: '1.0.0',
      };
      const output = formatVerdict(verdict);
      expect(output).not.toContain('\x1b');
      expect(output).toContain('BLOCKED');
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

    it('outputs JSON with verdicts when json flag is true', () => {
      const verdicts = [{ action: 'allow' as const, signals: [], summary: 'clean' }];
      const result = formatScanResult({
        total: 5, blocked: 0, warned: 0, clean: 5, verdicts,
      }, true);
      const parsed = JSON.parse(result);
      expect(parsed.total).toBe(5);
      expect(parsed.blocked).toBe(0);
      expect(Array.isArray(parsed.verdicts)).toBe(true);
      expect(parsed.verdicts.length).toBe(1);
      expect(parsed.verdicts[0].action).toBe('allow');
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

    it('includes package manager names in text output', () => {
      const result = formatInitSuccess(false, ['npm', 'bun']);
      expect(result).toContain('Ward initialized');
      expect(result).toContain('npm + bun');
    });

    it('includes package manager names in JSON output', () => {
      const result = formatInitSuccess(true, ['npm', 'bun']);
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.message).toContain('npm + bun');
      expect(parsed.packageManagers).toEqual(['npm', 'bun']);
    });

    it('shows single PM without plus sign', () => {
      const result = formatInitSuccess(false, ['npm']);
      expect(result).toContain('(npm)');
      expect(result).not.toContain('+');
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

    it('shows human-readable time-ago for dbAge', () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const result = formatStatus({
        initialized: true, dbAge: tenMinutesAgo, threatCount: 50, sensitivity: 'normal',
      }, false);
      expect(result).toContain('10 minutes ago');
    });
  });

  describe('timeAgo', () => {
    it('returns "never synced" for null', () => {
      expect(timeAgo(null)).toBe('never synced');
    });

    it('returns "never synced" for invalid date string', () => {
      expect(timeAgo('not-a-date')).toBe('never synced');
    });

    it('returns "just now" for future timestamps', () => {
      const future = new Date(Date.now() + 60000).toISOString();
      expect(timeAgo(future)).toBe('just now');
    });

    it('returns "just now" for less than 60 seconds ago', () => {
      const recent = new Date(Date.now() - 30 * 1000).toISOString();
      expect(timeAgo(recent)).toBe('just now');
    });

    it('returns minutes ago', () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(timeAgo(fiveMinAgo)).toBe('5 minutes ago');
    });

    it('returns singular minute', () => {
      const oneMinAgo = new Date(Date.now() - 1 * 60 * 1000).toISOString();
      expect(timeAgo(oneMinAgo)).toBe('1 minute ago');
    });

    it('returns hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      expect(timeAgo(twoHoursAgo)).toBe('2 hours ago');
    });

    it('returns singular hour', () => {
      const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
      expect(timeAgo(oneHourAgo)).toBe('1 hour ago');
    });

    it('returns days ago', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      expect(timeAgo(threeDaysAgo)).toBe('3 days ago');
    });

    it('returns months ago for very old timestamps', () => {
      const twoMonthsAgo = new Date(Date.now() - 65 * 24 * 60 * 60 * 1000).toISOString();
      expect(timeAgo(twoMonthsAgo)).toBe('2 months ago');
    });

    it('returns years ago for ancient timestamps', () => {
      const twoYearsAgo = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString();
      expect(timeAgo(twoYearsAgo)).toBe('2 years ago');
    });
  });

  describe('formatVerdictClinical', () => {
    it('formats allow verdict in clinical mode', () => {
      const verdict: Verdict = { action: 'allow', signals: [], summary: 'clean' };
      const output = formatVerdictClinical(verdict, {
        packageName: 'express',
        packageVersion: '4.19.0',
      });
      expect(output).toContain('express@4.19.0');
      expect(output).toContain('allow');
      expect(output).toContain('none');
    });

    it('formats block verdict in clinical mode with safe version', () => {
      const verdict: Verdict = {
        action: 'block',
        signals: [{ type: 'known-threat', severity: 'critical', message: 'Malicious' }],
        summary: 'BLOCKED',
        explanation: 'Steals SSH keys',
        safeVersion: '1.14.0',
      };
      const output = formatVerdictClinical(verdict, {
        packageName: 'axios',
        packageVersion: '1.14.1',
      });
      expect(output).toContain('axios@1.14.1');
      expect(output).toContain('known-threat');
      expect(output).toContain('block');
      expect(output).toContain('Safe: 1.14.0');
    });

    it('formats warn verdict in clinical mode', () => {
      const verdict: Verdict = {
        action: 'warn',
        signals: [{ type: 'typosquat', severity: 'warning', message: 'Similar to axios' }],
        summary: 'suspicious',
      };
      const output = formatVerdictClinical(verdict, {
        packageName: 'axois',
        packageVersion: '1.0.0',
      });
      expect(output).toContain('axois@1.0.0');
      expect(output).toContain('typosquat');
      expect(output).toContain('warn');
    });

    it('uses "unknown" when no package info provided', () => {
      const verdict: Verdict = { action: 'allow', signals: [], summary: 'clean' };
      const output = formatVerdictClinical(verdict);
      expect(output).toContain('unknown');
    });
  });

  describe('formatVerdictVerbose', () => {
    it('includes Ward Score for allow verdict', () => {
      const verdict: Verdict = { action: 'allow', signals: [], summary: 'clean' };
      const output = formatVerdictVerbose(verdict, { checkTimeMs: 42 });
      expect(output).toContain('Ward Score: 100/100');
      expect(output).toContain('Checked:');
      expect(output).toContain('Check time: 42ms');
    });

    it('includes Ward Score for warn verdict', () => {
      const verdict: Verdict = {
        action: 'warn',
        signals: [{ type: 'typosquat', severity: 'warning', message: 'Similar' }],
        summary: 'suspicious',
      };
      const output = formatVerdictVerbose(verdict, { checkTimeMs: 15 });
      expect(output).toContain('Ward Score: 50/100');
      expect(output).toContain('Check time: 15ms');
    });

    it('includes Ward Score for block verdict', () => {
      const verdict: Verdict = {
        action: 'block',
        signals: [{ type: 'known-threat', severity: 'critical', message: 'Mal' }],
        summary: 'BLOCKED',
      };
      const output = formatVerdictVerbose(verdict, { checkTimeMs: 5 });
      expect(output).toContain('Ward Score: 0/100');
      expect(output).toContain('Check time: 5ms');
    });

    it('shows custom checks ran', () => {
      const verdict: Verdict = { action: 'allow', signals: [], summary: 'clean' };
      const output = formatVerdictVerbose(verdict, {
        checkTimeMs: 10,
        checksRan: ['threat-db', 'typosquat'],
      });
      expect(output).toContain('Checked: threat-db, typosquat');
    });
  });
});
