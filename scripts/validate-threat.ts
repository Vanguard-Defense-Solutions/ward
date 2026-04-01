import { readFileSync } from "fs";
import { parse } from "yaml";

const ALLOWED_THREAT_TYPES = [
  "malicious-code",
  "credential-theft",
  "cryptominer",
  "backdoor",
  "typosquat",
] as const;

const REQUIRED_FIELDS = [
  "package_name",
  "version",
  "threat_type",
  "description",
  "safe_version",
  "detected_at",
  "references",
  "submitted_by",
] as const;

const MAX_DESCRIPTION_LENGTH = 200;

export interface ValidationResult {
  check: string;
  pass: boolean;
  message: string;
}

export interface ValidationReport {
  file: string;
  results: ValidationResult[];
  pass: boolean;
}

export function validateThreatYaml(
  content: string,
  file: string,
  existingThreats: Array<{ package_name: string; version: string }> = []
): ValidationReport {
  const results: ValidationResult[] = [];

  // 1. Parse YAML
  let data: Record<string, unknown>;
  try {
    data = parse(content);
    if (!data || typeof data !== "object") {
      throw new Error("YAML did not parse to an object");
    }
    results.push({ check: "yaml-parse", pass: true, message: "YAML is valid" });
  } catch (err) {
    results.push({
      check: "yaml-parse",
      pass: false,
      message: `Invalid YAML: ${(err as Error).message}`,
    });
    return { file, results, pass: false };
  }

  // 2. Required fields
  for (const field of REQUIRED_FIELDS) {
    const value = data[field];
    if (field === "references") {
      const refs = value as Array<{ url: string }> | undefined;
      const hasRefs =
        Array.isArray(refs) &&
        refs.length > 0 &&
        refs.some((r) => r && typeof r.url === "string" && r.url.length > 0);
      results.push({
        check: `required-${field}`,
        pass: hasRefs,
        message: hasRefs
          ? `${field}: present with at least one URL`
          : `${field}: must have at least one reference with a non-empty url`,
      });
    } else {
      const present =
        value !== undefined &&
        value !== null &&
        String(value).trim().length > 0;
      results.push({
        check: `required-${field}`,
        pass: present,
        message: present
          ? `${field}: present`
          : `${field}: missing or empty`,
      });
    }
  }

  // 3. Validate threat_type enum
  const threatType = data.threat_type as string;
  const validType = ALLOWED_THREAT_TYPES.includes(
    threatType as (typeof ALLOWED_THREAT_TYPES)[number]
  );
  results.push({
    check: "threat-type-enum",
    pass: validType,
    message: validType
      ? `threat_type "${threatType}" is valid`
      : `threat_type "${threatType}" is not one of: ${ALLOWED_THREAT_TYPES.join(", ")}`,
  });

  // 4. Description length
  const description = String(data.description || "");
  const descOk = description.length > 0 && description.length <= MAX_DESCRIPTION_LENGTH;
  results.push({
    check: "description-length",
    pass: descOk,
    message: descOk
      ? `Description is ${description.length} chars (max ${MAX_DESCRIPTION_LENGTH})`
      : `Description is ${description.length} chars (max ${MAX_DESCRIPTION_LENGTH})`,
  });

  // 5. Duplicate check
  const key = `${data.package_name}@${data.version}`;
  const isDuplicate = existingThreats.some(
    (t) => t.package_name === data.package_name && t.version === data.version
  );
  results.push({
    check: "duplicate-check",
    pass: !isDuplicate,
    message: isDuplicate
      ? `Duplicate: ${key} already exists in seed-threats.json`
      : `No duplicate found for ${key}`,
  });

  const pass = results.every((r) => r.pass);
  return { file, results, pass };
}

function formatReport(report: ValidationReport): string {
  const lines: string[] = [];
  for (const r of report.results) {
    const icon = r.pass ? "PASS" : "FAIL";
    lines.push(`[${icon}] ${r.check}: ${r.message}`);
  }
  const overall = report.pass ? "ALL CHECKS PASSED" : "VALIDATION FAILED";
  lines.push(`\n${overall}`);
  return lines.join("\n");
}

// CLI entrypoint
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}` ||
    process.argv[1]?.endsWith("validate-threat.ts")) {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: bun run scripts/validate-threat.ts <file.yml>");
    process.exit(1);
  }

  const content = readFileSync(file, "utf8");

  // Load existing threats for duplicate checking
  let existingThreats: Array<{ package_name: string; version: string }> = [];
  try {
    const seedPath = new URL(
      "../packages/shared/data/seed-threats.json",
      import.meta.url
    );
    existingThreats = JSON.parse(readFileSync(seedPath, "utf8"));
  } catch {
    // If seed file not found, skip duplicate check
  }

  const report = validateThreatYaml(content, file, existingThreats);
  console.log(formatReport(report));
  process.exit(report.pass ? 0 : 1);
}
