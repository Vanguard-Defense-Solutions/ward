import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';

const CLI_PATH = path.resolve(__dirname, '../../src/index.ts');
const RUN = `bun ${CLI_PATH}`;

describe('E2E: CLI entry point', () => {
  it('shows help with --help flag', () => {
    const result = execSync(`${RUN} --help`, { encoding: 'utf-8' });
    expect(result).toContain('ward');
    expect(result).toContain('init');
    expect(result).toContain('scan');
    expect(result).toContain('status');
  });

  it('shows version with --version flag', () => {
    const result = execSync(`${RUN} --version`, { encoding: 'utf-8' });
    expect(result.trim()).toBe('0.3.0');
  });

  it('shows help for init subcommand', () => {
    const result = execSync(`${RUN} init --help`, { encoding: 'utf-8' });
    expect(result).toContain('Initialize');
    expect(result).toContain('--json');
  });

  it('shows help for scan subcommand', () => {
    const result = execSync(`${RUN} scan --help`, { encoding: 'utf-8' });
    expect(result).toContain('Scan');
    expect(result).toContain('--json');
  });

  it('exits with error for unknown command', () => {
    try {
      execSync(`${RUN} nonexistent 2>&1`, { encoding: 'utf-8', stdio: 'pipe' });
      expect.fail('Should have thrown');
    } catch (e: any) {
      const output = (e.stderr?.toString() ?? '') + (e.stdout?.toString() ?? '') + (e.message ?? '');
      expect(output).toContain('unknown command');
    }
  });
});
