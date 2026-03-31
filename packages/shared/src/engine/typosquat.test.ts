import { describe, it, expect } from 'vitest';
import { checkTyposquat, levenshtein } from './typosquat';

describe('Typosquat Detection', () => {
  // Unit tests — Levenshtein distance
  describe('levenshtein', () => {
    it('returns 0 for identical strings', () => {
      expect(levenshtein('axios', 'axios')).toBe(0);
    });

    it('returns correct distance for one substitution', () => {
      expect(levenshtein('axios', 'axxos')).toBe(1);
    });

    it('returns correct distance for one insertion', () => {
      expect(levenshtein('lodash', 'loddash')).toBe(1);
    });

    it('returns correct distance for one deletion', () => {
      expect(levenshtein('express', 'expres')).toBe(1);
    });

    it('handles empty strings', () => {
      expect(levenshtein('', 'abc')).toBe(3);
      expect(levenshtein('abc', '')).toBe(3);
      expect(levenshtein('', '')).toBe(0);
    });
  });

  // Unit tests — typosquat checking
  describe('checkTyposquat', () => {
    const topPackages = ['axios', 'lodash', 'express', 'react', 'next', 'typescript', 'webpack', 'vite'];

    it('returns null for exact match (legitimate package)', () => {
      expect(checkTyposquat('axios', topPackages)).toBeNull();
    });

    it('warns for one-char substitution typosquat', () => {
      const signal = checkTyposquat('axxios', topPackages);
      expect(signal).not.toBeNull();
      expect(signal!.severity).toBe('warning');
      expect(signal!.message).toContain('axios');
    });

    it('warns for one-char insertion typosquat', () => {
      const signal = checkTyposquat('loddash', topPackages);
      expect(signal).not.toBeNull();
      expect(signal!.message).toContain('lodash');
    });

    it('warns for one-char deletion typosquat', () => {
      const signal = checkTyposquat('expres', topPackages);
      expect(signal).not.toBeNull();
      expect(signal!.message).toContain('express');
    });

    it('warns for character swap typosquat', () => {
      const signal = checkTyposquat('axois', topPackages);
      expect(signal).not.toBeNull();
      expect(signal!.message).toContain('axios');
    });

    it('does not warn for distant names (distance > 2)', () => {
      expect(checkTyposquat('completely-different', topPackages)).toBeNull();
    });

    it('does not warn for short package names (3 chars or less)', () => {
      // Short names have too many false positives
      expect(checkTyposquat('nex', ['next'])).toBeNull();
    });

    it('handles scoped packages (strips scope for comparison)', () => {
      const signal = checkTyposquat('@someone/axxios', topPackages);
      expect(signal).not.toBeNull();
      expect(signal!.message).toContain('axios');
    });

    it('handles hyphen/underscore swaps', () => {
      const packages = ['my-package'];
      const signal = checkTyposquat('my_package', packages);
      expect(signal).not.toBeNull();
    });

    it('reports the closest match when multiple are close', () => {
      const signal = checkTyposquat('reacct', ['react', 'reach']);
      expect(signal).not.toBeNull();
      // Should match closest
      expect(signal!.message).toContain('react');
    });

    it('returns null when package list is empty', () => {
      expect(checkTyposquat('anything', [])).toBeNull();
    });
  });
});
