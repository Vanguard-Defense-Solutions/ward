import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We can't easily test the actual readline prompt in unit tests,
// but we CAN test the non-TTY fallback behavior and the logic.

describe('confirm prompt', () => {
  const originalIsTTY = process.stdin.isTTY;

  afterEach(() => {
    Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, writable: true });
  });

  it('returns false (default no) when stdin is not a TTY', async () => {
    Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true });
    const { confirm } = await import('../../src/prompt');
    const result = await confirm('Proceed?');
    expect(result).toBe(false);
  });

  it('returns true (default yes) when stdin is not a TTY and defaultNo is false', async () => {
    Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true });
    const { confirm } = await import('../../src/prompt');
    const result = await confirm('Proceed?', false);
    expect(result).toBe(true);
  });

  it('non-TTY never blocks — returns immediately', async () => {
    Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true });
    const { confirm } = await import('../../src/prompt');
    const start = Date.now();
    await confirm('Proceed?');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(50); // Should be instant
  });
});

describe('confirm behavior in CI/hook contexts', () => {
  it('npm preinstall hook has no TTY — warnings auto-decline', async () => {
    // When ward check-install runs as a preinstall hook,
    // process.stdin.isTTY is undefined/false.
    // Warnings should NOT block the install — they auto-decline (default No).
    Object.defineProperty(process.stdin, 'isTTY', { value: undefined, writable: true });
    const { confirm } = await import('../../src/prompt');
    const result = await confirm('Proceed?');
    expect(result).toBe(false);
  });

  it('CI environment has no TTY — warnings auto-decline', async () => {
    Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true });
    const { confirm } = await import('../../src/prompt');
    const result = await confirm('Suspicious package. Proceed?');
    expect(result).toBe(false);
  });
});
