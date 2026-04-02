import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// --- Types ---

interface GitHubAdvisoryVulnerability {
  package: {
    ecosystem: string;
    name: string;
  } | null;
  vulnerable_version_range: string | null;
  first_patched_version: string | null;
}

interface GitHubAdvisory {
  ghsa_id: string;
  summary: string;
  description: string;
  severity: string;
  type: string; // "reviewed" or "malware"
  published_at: string;
  vulnerabilities: GitHubAdvisoryVulnerability[];
}

interface ThreatEntry {
  package_name: string;
  version: string;
  threat_type: string;
  description: string;
  safe_version: string;
  detected_at: string;
}

// --- Constants ---

const ADVISORY_API_URL =
  'https://api.github.com/advisories?ecosystem=npm&severity=critical&severity=high&per_page=100';

const SEED_THREATS_PATH = resolve(
  import.meta.dir ?? __dirname,
  '../packages/shared/data/seed-threats.json',
);

const SUPPLY_CHAIN_KEYWORDS = [
  'malicious',
  'backdoor',
  'credential',
  'cryptominer',
  'typosquat',
  'hijack',
  'compromise',
  'malware',
  'trojan',
  'exfiltrat',
  'reverse shell',
  'steal',
  'c2 ',
  'command and control',
  'rootkit',
];

const THREAT_TYPE_MAP: Record<string, string> = {
  malware: 'malicious-code',
  malicious: 'malicious-code',
  backdoor: 'backdoor',
  credential: 'credential-theft',
  steal: 'credential-theft',
  exfiltrat: 'credential-theft',
  cryptominer: 'cryptominer',
  typosquat: 'typosquat',
  hijack: 'backdoor',
  trojan: 'backdoor',
  rootkit: 'backdoor',
  'reverse shell': 'backdoor',
};

// --- Core functions (exported for testing) ---

/**
 * Determine if an advisory is relevant (malware type or supply-chain keywords).
 */
export function isSupplyChainThreat(advisory: GitHubAdvisory): boolean {
  if (advisory.type === 'malware') return true;

  const text = `${advisory.summary} ${advisory.description}`.toLowerCase();
  return SUPPLY_CHAIN_KEYWORDS.some((kw) => text.includes(kw));
}

/**
 * Infer the threat type from advisory text.
 */
export function inferThreatType(advisory: GitHubAdvisory): string {
  if (advisory.type === 'malware') return 'malicious-code';

  const text = `${advisory.summary} ${advisory.description}`.toLowerCase();
  for (const [keyword, threatType] of Object.entries(THREAT_TYPE_MAP)) {
    if (text.includes(keyword)) return threatType;
  }
  return 'malicious-code'; // fallback
}

/**
 * Truncate and clean a description to a plain-English summary under 200 chars.
 */
export function formatDescription(summary: string): string {
  // Strip CVE/GHSA references
  let cleaned = summary
    .replace(/CVE-\d{4}-\d+/gi, '')
    .replace(/GHSA-[a-z0-9-]+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length > 200) {
    cleaned = cleaned.slice(0, 197) + '...';
  }
  return cleaned;
}

/**
 * Extract a concrete version from a vulnerable_version_range string.
 * E.g. "= 1.0.0" -> "1.0.0", ">= 1.0.0, < 2.0.0" -> "1.0.0"
 */
export function extractVersion(
  range: string | null,
  patchedVersion: string | null,
): string {
  if (!range) return 'unknown';

  // Exact match: "= 1.0.0"
  const exactMatch = range.match(/^=\s*([\d.][^\s,]*)/);
  if (exactMatch) return exactMatch[1];

  // Range with lower bound: ">= 1.0.0, < 2.0.0" — use lower bound
  const lowerBound = range.match(/>=?\s*([\d.][^\s,]*)/);
  if (lowerBound) return lowerBound[1];

  // If only upper bound, try to derive from patched version
  if (patchedVersion) return patchedVersion;

  // Fallback: extract any version-like string
  const anyVersion = range.match(/([\d]+\.[\d]+\.[\d]+[^\s,]*)/);
  if (anyVersion) return anyVersion[1];

  return 'unknown';
}

/**
 * Convert a single GitHub advisory + vulnerability to a ThreatEntry.
 */
export function advisoryToThreat(
  advisory: GitHubAdvisory,
  vuln: GitHubAdvisoryVulnerability,
): ThreatEntry | null {
  if (!vuln.package || vuln.package.ecosystem !== 'npm') return null;

  return {
    package_name: vuln.package.name,
    version: extractVersion(
      vuln.vulnerable_version_range,
      vuln.first_patched_version,
    ),
    threat_type: inferThreatType(advisory),
    description: formatDescription(advisory.summary),
    safe_version: vuln.first_patched_version ?? 'none',
    detected_at: advisory.published_at,
  };
}

/**
 * Convert a list of advisories into ThreatEntry[], filtering for supply-chain threats.
 */
export function convertAdvisories(advisories: GitHubAdvisory[]): ThreatEntry[] {
  const threats: ThreatEntry[] = [];

  for (const advisory of advisories) {
    if (!isSupplyChainThreat(advisory)) continue;
    if (!Array.isArray(advisory.vulnerabilities)) continue;

    for (const vuln of advisory.vulnerabilities) {
      const threat = advisoryToThreat(advisory, vuln);
      if (threat) threats.push(threat);
    }
  }

  return threats;
}

/**
 * Deduplicate new threats against existing entries.
 * Match on package_name + version.
 */
export function deduplicateThreats(
  existing: ThreatEntry[],
  incoming: ThreatEntry[],
): ThreatEntry[] {
  const existingKeys = new Set(
    existing.map((t) => `${t.package_name}@${t.version}`),
  );
  return incoming.filter((t) => !existingKeys.has(`${t.package_name}@${t.version}`));
}

/**
 * Fetch advisories from GitHub Advisory Database API.
 */
export async function fetchAdvisories(): Promise<GitHubAdvisory[]> {
  const response = await fetch(ADVISORY_API_URL, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    throw new Error(
      `GitHub API returned ${response.status}: ${response.statusText}`,
    );
  }

  return response.json() as Promise<GitHubAdvisory[]>;
}

// --- Main ---

export async function main(): Promise<void> {
  console.log('Fetching npm advisories from GitHub Advisory Database...');

  const advisories = await fetchAdvisories();
  console.log(`Fetched ${advisories.length} advisories`);

  const newThreats = convertAdvisories(advisories);
  console.log(`Found ${newThreats.length} supply-chain threats`);

  const existing: ThreatEntry[] = JSON.parse(
    readFileSync(SEED_THREATS_PATH, 'utf-8'),
  );

  const uniqueNew = deduplicateThreats(existing, newThreats);
  const merged = [...existing, ...uniqueNew];

  writeFileSync(SEED_THREATS_PATH, JSON.stringify(merged, null, 2) + '\n');

  console.log(`Added ${uniqueNew.length} new threats (${merged.length} total)`);

  if (uniqueNew.length === 0) {
    process.exit(1);
  }
}

// Run when executed directly (Bun supports import.meta.main)
if (import.meta.main) {
  main().catch((err) => {
    console.error('Fatal:', err);
    process.exit(2);
  });
}
