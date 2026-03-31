import { describe, it, expect } from 'vitest';
import { checkVersionAnomaly } from './version-anomaly';

describe('Version Anomaly Detection', () => {
  describe('checkVersionAnomaly', () => {
    it('returns null for a normal version', () => {
      expect(checkVersionAnomaly('express', '4.19.0', '4.18.2')).toBeNull();
    });

    it('returns null when no previous version known', () => {
      expect(checkVersionAnomaly('new-pkg', '1.0.0', null)).toBeNull();
    });

    it('flags major version jump (e.g. 1.x to 4.x)', () => {
      const signal = checkVersionAnomaly('pkg', '4.0.0', '1.2.3');
      expect(signal).not.toBeNull();
      expect(signal!.severity).toBe('warning');
      expect(signal!.message).toContain('major version jump');
    });

    it('allows normal major bump (1.x to 2.x)', () => {
      expect(checkVersionAnomaly('pkg', '2.0.0', '1.9.0')).toBeNull();
    });

    it('flags version that does not exist in registry', () => {
      // This is checked via a flag, not live registry lookup
      const signal = checkVersionAnomaly('pkg', '99.0.0', '1.0.0', { exists: false });
      expect(signal).not.toBeNull();
      expect(signal!.severity).toBe('warning');
      expect(signal!.message).toContain('not found');
    });

    it('handles prerelease versions', () => {
      expect(checkVersionAnomaly('pkg', '2.0.0-rc.1', '1.9.0')).toBeNull();
    });

    it('handles invalid version strings gracefully', () => {
      expect(checkVersionAnomaly('pkg', 'not-a-version', '1.0.0')).toBeNull();
    });
  });
});
