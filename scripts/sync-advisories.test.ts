import { describe, it, expect } from 'vitest';
import {
  isSupplyChainThreat,
  inferThreatType,
  formatDescription,
  extractVersion,
  advisoryToThreat,
  convertAdvisories,
  deduplicateThreats,
} from './sync-advisories';

// --- Helpers ---

function makeAdvisory(overrides: Record<string, unknown> = {}) {
  return {
    ghsa_id: 'GHSA-test-1234',
    summary: 'Malicious package steals credentials',
    description: 'This package contains malicious code that exfiltrates environment variables.',
    severity: 'critical',
    type: 'malware',
    published_at: '2025-01-15T00:00:00Z',
    vulnerabilities: [
      {
        package: { ecosystem: 'npm', name: 'evil-pkg' },
        vulnerable_version_range: '= 1.0.0',
        first_patched_version: null,
      },
    ],
    ...overrides,
  };
}

function makeVuln(overrides: Record<string, unknown> = {}) {
  return {
    package: { ecosystem: 'npm', name: 'evil-pkg' },
    vulnerable_version_range: '= 1.0.0',
    first_patched_version: null,
    ...overrides,
  };
}

// --- Tests ---

describe('isSupplyChainThreat', () => {
  it('returns true for malware-type advisories', () => {
    const advisory = makeAdvisory({ type: 'malware' });
    expect(isSupplyChainThreat(advisory)).toBe(true);
  });

  it('returns true when summary contains supply-chain keywords', () => {
    const advisory = makeAdvisory({
      type: 'reviewed',
      summary: 'Package contains backdoor that exfiltrates data',
    });
    expect(isSupplyChainThreat(advisory)).toBe(true);
  });

  it('returns true when description contains supply-chain keywords', () => {
    const advisory = makeAdvisory({
      type: 'reviewed',
      summary: 'Security vulnerability in foo',
      description: 'The attacker installed a cryptominer in the postinstall script',
    });
    expect(isSupplyChainThreat(advisory)).toBe(true);
  });

  it('returns false for regular CVEs without supply-chain keywords', () => {
    const advisory = makeAdvisory({
      type: 'reviewed',
      summary: 'Buffer overflow in XML parser',
      description: 'A specially crafted XML document can cause a heap-based buffer overflow.',
    });
    expect(isSupplyChainThreat(advisory)).toBe(false);
  });

  it('returns false for prototype pollution without supply-chain keywords', () => {
    const advisory = makeAdvisory({
      type: 'reviewed',
      summary: 'Prototype pollution in lodash.merge',
      description: 'Recursive merge allows modifying Object.prototype properties.',
    });
    expect(isSupplyChainThreat(advisory)).toBe(false);
  });
});

describe('inferThreatType', () => {
  it('maps malware-type advisory to malicious-code', () => {
    expect(inferThreatType(makeAdvisory({ type: 'malware' }))).toBe('malicious-code');
  });

  it('maps backdoor keyword to backdoor', () => {
    expect(
      inferThreatType(
        makeAdvisory({
          type: 'reviewed',
          summary: 'Package contains a backdoor',
          description: '',
        }),
      ),
    ).toBe('backdoor');
  });

  it('maps credential keyword to credential-theft', () => {
    expect(
      inferThreatType(
        makeAdvisory({
          type: 'reviewed',
          summary: 'Steals credential tokens',
          description: '',
        }),
      ),
    ).toBe('credential-theft');
  });

  it('maps cryptominer keyword to cryptominer', () => {
    expect(
      inferThreatType(
        makeAdvisory({
          type: 'reviewed',
          summary: 'Installs cryptominer via postinstall',
          description: '',
        }),
      ),
    ).toBe('cryptominer');
  });

  it('maps typosquat keyword to typosquat', () => {
    expect(
      inferThreatType(
        makeAdvisory({
          type: 'reviewed',
          summary: 'Typosquat of popular package',
          description: '',
        }),
      ),
    ).toBe('typosquat');
  });

  it('falls back to malicious-code for unknown keywords', () => {
    expect(
      inferThreatType(
        makeAdvisory({
          type: 'reviewed',
          summary: 'Malicious package does bad things',
          description: '',
        }),
      ),
    ).toBe('malicious-code');
  });
});

describe('formatDescription', () => {
  it('strips CVE references', () => {
    const result = formatDescription('CVE-2024-12345 allows remote code execution');
    expect(result).not.toContain('CVE-2024-12345');
    expect(result).toContain('allows remote code execution');
  });

  it('strips GHSA references', () => {
    const result = formatDescription('GHSA-abcd-efgh-ijkl in package foo');
    expect(result).not.toContain('GHSA-abcd-efgh-ijkl');
    expect(result).toContain('in package foo');
  });

  it('truncates to 200 characters', () => {
    const longText = 'A'.repeat(300);
    const result = formatDescription(longText);
    expect(result.length).toBeLessThanOrEqual(200);
    expect(result.endsWith('...')).toBe(true);
  });

  it('preserves short descriptions unchanged', () => {
    const result = formatDescription('Malicious package steals SSH keys');
    expect(result).toBe('Malicious package steals SSH keys');
  });

  it('collapses whitespace', () => {
    const result = formatDescription('Too   many    spaces    here');
    expect(result).toBe('Too many spaces here');
  });
});

describe('extractVersion', () => {
  it('extracts exact version from "= 1.0.0"', () => {
    expect(extractVersion('= 1.0.0', null)).toBe('1.0.0');
  });

  it('extracts lower bound from range ">= 1.0.0, < 2.0.0"', () => {
    expect(extractVersion('>= 1.0.0, < 2.0.0', null)).toBe('1.0.0');
  });

  it('falls back to patched version when no parseable range', () => {
    expect(extractVersion('< 2.0.0', '2.0.0')).toBe('2.0.0');
  });

  it('returns "unknown" for null range', () => {
    expect(extractVersion(null, null)).toBe('unknown');
  });

  it('handles pre-release versions', () => {
    expect(extractVersion('= 1.0.0-alpha.1', null)).toBe('1.0.0-alpha.1');
  });

  it('extracts version from "< 3.0.0" with patched version', () => {
    expect(extractVersion('< 3.0.0', '3.0.0')).toBe('3.0.0');
  });
});

describe('advisoryToThreat', () => {
  it('converts a valid advisory + vulnerability to ThreatEntry', () => {
    const advisory = makeAdvisory();
    const vuln = makeVuln();
    const result = advisoryToThreat(advisory, vuln);

    expect(result).toEqual({
      package_name: 'evil-pkg',
      version: '1.0.0',
      threat_type: 'malicious-code',
      description: 'Malicious package steals credentials',
      safe_version: 'none',
      detected_at: '2025-01-15T00:00:00Z',
    });
  });

  it('returns null for non-npm packages', () => {
    const advisory = makeAdvisory();
    const vuln = makeVuln({
      package: { ecosystem: 'pypi', name: 'evil-pkg' },
    });
    expect(advisoryToThreat(advisory, vuln)).toBeNull();
  });

  it('returns null when package is null', () => {
    const advisory = makeAdvisory();
    const vuln = makeVuln({ package: null });
    expect(advisoryToThreat(advisory, vuln)).toBeNull();
  });

  it('uses first_patched_version as safe_version', () => {
    const advisory = makeAdvisory();
    const vuln = makeVuln({ first_patched_version: '2.0.0' });
    const result = advisoryToThreat(advisory, vuln);

    expect(result?.safe_version).toBe('2.0.0');
  });
});

describe('convertAdvisories', () => {
  it('filters out non-supply-chain advisories', () => {
    const advisories = [
      makeAdvisory({ type: 'malware' }), // keep
      makeAdvisory({
        type: 'reviewed',
        summary: 'Buffer overflow in parser',
        description: 'Memory corruption vulnerability.',
        vulnerabilities: [makeVuln({ package: { ecosystem: 'npm', name: 'safe-pkg' } })],
      }), // skip
    ];
    const result = convertAdvisories(advisories);
    expect(result).toHaveLength(1);
    expect(result[0].package_name).toBe('evil-pkg');
  });

  it('handles multiple vulnerabilities per advisory', () => {
    const advisory = makeAdvisory({
      vulnerabilities: [
        makeVuln({ package: { ecosystem: 'npm', name: 'pkg-a' } }),
        makeVuln({ package: { ecosystem: 'npm', name: 'pkg-b' } }),
      ],
    });
    const result = convertAdvisories([advisory]);
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.package_name)).toEqual(['pkg-a', 'pkg-b']);
  });

  it('skips vulnerabilities with null package', () => {
    const advisory = makeAdvisory({
      vulnerabilities: [
        makeVuln({ package: null }),
        makeVuln({ package: { ecosystem: 'npm', name: 'good-pkg' } }),
      ],
    });
    const result = convertAdvisories([advisory]);
    expect(result).toHaveLength(1);
    expect(result[0].package_name).toBe('good-pkg');
  });

  it('handles advisory with missing vulnerabilities array', () => {
    const advisory = makeAdvisory({ vulnerabilities: null });
    const result = convertAdvisories([advisory]);
    expect(result).toHaveLength(0);
  });

  it('handles empty advisories array', () => {
    expect(convertAdvisories([])).toHaveLength(0);
  });
});

describe('deduplicateThreats', () => {
  it('removes threats that already exist by package_name + version', () => {
    const existing = [
      {
        package_name: 'evil-pkg',
        version: '1.0.0',
        threat_type: 'malicious-code',
        description: 'Already known',
        safe_version: 'none',
        detected_at: '2025-01-01T00:00:00Z',
      },
    ];
    const incoming = [
      {
        package_name: 'evil-pkg',
        version: '1.0.0',
        threat_type: 'malicious-code',
        description: 'Duplicate',
        safe_version: 'none',
        detected_at: '2025-01-15T00:00:00Z',
      },
      {
        package_name: 'new-pkg',
        version: '2.0.0',
        threat_type: 'backdoor',
        description: 'New threat',
        safe_version: '2.0.1',
        detected_at: '2025-01-15T00:00:00Z',
      },
    ];
    const result = deduplicateThreats(existing, incoming);
    expect(result).toHaveLength(1);
    expect(result[0].package_name).toBe('new-pkg');
  });

  it('keeps all threats when there are no duplicates', () => {
    const existing = [
      {
        package_name: 'pkg-a',
        version: '1.0.0',
        threat_type: 'malicious-code',
        description: 'Existing',
        safe_version: 'none',
        detected_at: '2025-01-01T00:00:00Z',
      },
    ];
    const incoming = [
      {
        package_name: 'pkg-b',
        version: '1.0.0',
        threat_type: 'backdoor',
        description: 'New',
        safe_version: '1.0.1',
        detected_at: '2025-01-15T00:00:00Z',
      },
    ];
    const result = deduplicateThreats(existing, incoming);
    expect(result).toHaveLength(1);
    expect(result[0].package_name).toBe('pkg-b');
  });

  it('returns empty array when all incoming are duplicates', () => {
    const existing = [
      {
        package_name: 'evil-pkg',
        version: '1.0.0',
        threat_type: 'malicious-code',
        description: 'Known',
        safe_version: 'none',
        detected_at: '2025-01-01T00:00:00Z',
      },
    ];
    const incoming = [
      {
        package_name: 'evil-pkg',
        version: '1.0.0',
        threat_type: 'backdoor',
        description: 'Same package+version',
        safe_version: 'none',
        detected_at: '2025-02-01T00:00:00Z',
      },
    ];
    const result = deduplicateThreats(existing, incoming);
    expect(result).toHaveLength(0);
  });

  it('treats same package with different versions as distinct', () => {
    const existing = [
      {
        package_name: 'evil-pkg',
        version: '1.0.0',
        threat_type: 'malicious-code',
        description: 'v1',
        safe_version: 'none',
        detected_at: '2025-01-01T00:00:00Z',
      },
    ];
    const incoming = [
      {
        package_name: 'evil-pkg',
        version: '2.0.0',
        threat_type: 'malicious-code',
        description: 'v2',
        safe_version: 'none',
        detected_at: '2025-01-15T00:00:00Z',
      },
    ];
    const result = deduplicateThreats(existing, incoming);
    expect(result).toHaveLength(1);
    expect(result[0].version).toBe('2.0.0');
  });

  it('handles empty existing array', () => {
    const incoming = [
      {
        package_name: 'new-pkg',
        version: '1.0.0',
        threat_type: 'malicious-code',
        description: 'All new',
        safe_version: 'none',
        detected_at: '2025-01-15T00:00:00Z',
      },
    ];
    const result = deduplicateThreats([], incoming);
    expect(result).toHaveLength(1);
  });
});

describe('malformed advisory handling', () => {
  it('handles advisory with empty summary', () => {
    const advisory = makeAdvisory({ summary: '' });
    const result = convertAdvisories([advisory]);
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('');
  });

  it('handles advisory with empty vulnerabilities array', () => {
    const advisory = makeAdvisory({ vulnerabilities: [] });
    const result = convertAdvisories([advisory]);
    expect(result).toHaveLength(0);
  });

  it('handles vulnerability with null version range', () => {
    const advisory = makeAdvisory({
      vulnerabilities: [
        makeVuln({ vulnerable_version_range: null, first_patched_version: null }),
      ],
    });
    const result = convertAdvisories([advisory]);
    expect(result).toHaveLength(1);
    expect(result[0].version).toBe('unknown');
  });

  it('handles vulnerability with null first_patched_version', () => {
    const advisory = makeAdvisory({
      vulnerabilities: [makeVuln({ first_patched_version: null })],
    });
    const result = convertAdvisories([advisory]);
    expect(result).toHaveLength(1);
    expect(result[0].safe_version).toBe('none');
  });

  it('skips non-npm ecosystem vulnerabilities within a mixed advisory', () => {
    const advisory = makeAdvisory({
      vulnerabilities: [
        makeVuln({ package: { ecosystem: 'pypi', name: 'py-evil' } }),
        makeVuln({ package: { ecosystem: 'npm', name: 'js-evil' } }),
        makeVuln({ package: { ecosystem: 'rubygems', name: 'rb-evil' } }),
      ],
    });
    const result = convertAdvisories([advisory]);
    expect(result).toHaveLength(1);
    expect(result[0].package_name).toBe('js-evil');
  });
});
