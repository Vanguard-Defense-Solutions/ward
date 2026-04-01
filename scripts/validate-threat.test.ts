import { describe, it, expect } from "vitest";
import { validateThreatYaml } from "./validate-threat";

const validYaml = `
package_name: "evil-package"
version: "1.0.0"
threat_type: "malicious-code"
description: "Steals npm tokens and AWS credentials via postinstall script"
safe_version: "none"
detected_at: "2025-01-15T00:00:00Z"
references:
  - url: "https://blog.example.com/evil-package-advisory"
submitted_by: "security-researcher"
`;

const existingThreats = [
  { package_name: "axios", version: "1.14.1" },
  { package_name: "event-stream", version: "3.3.6" },
];

describe("validate-threat", () => {
  it("accepts a valid submission", () => {
    const report = validateThreatYaml(validYaml, "test.yml", existingThreats);
    expect(report.pass).toBe(true);
    expect(report.results.every((r) => r.pass)).toBe(true);
  });

  it("rejects missing required fields", () => {
    const yaml = `
package_name: "evil-package"
version: "1.0.0"
`;
    const report = validateThreatYaml(yaml, "test.yml", []);
    expect(report.pass).toBe(false);

    const failedChecks = report.results.filter((r) => !r.pass);
    const failedNames = failedChecks.map((r) => r.check);
    expect(failedNames).toContain("required-threat_type");
    expect(failedNames).toContain("required-description");
    expect(failedNames).toContain("required-safe_version");
    expect(failedNames).toContain("required-detected_at");
    expect(failedNames).toContain("required-references");
    expect(failedNames).toContain("required-submitted_by");
  });

  it("rejects empty required fields", () => {
    const yaml = `
package_name: ""
version: ""
threat_type: ""
description: ""
safe_version: ""
detected_at: ""
references:
  - url: ""
submitted_by: ""
`;
    const report = validateThreatYaml(yaml, "test.yml", []);
    expect(report.pass).toBe(false);

    const failedNames = report.results
      .filter((r) => !r.pass)
      .map((r) => r.check);
    expect(failedNames).toContain("required-package_name");
    expect(failedNames).toContain("required-version");
    expect(failedNames).toContain("required-references");
  });

  it("rejects invalid threat_type", () => {
    const yaml = validYaml.replace("malicious-code", "buffer-overflow");
    const report = validateThreatYaml(yaml, "test.yml", []);
    expect(report.pass).toBe(false);

    const typeCheck = report.results.find(
      (r) => r.check === "threat-type-enum"
    );
    expect(typeCheck?.pass).toBe(false);
    expect(typeCheck?.message).toContain("buffer-overflow");
  });

  it("accepts all valid threat_type values", () => {
    const types = [
      "malicious-code",
      "credential-theft",
      "cryptominer",
      "backdoor",
      "typosquat",
    ];
    for (const type of types) {
      const yaml = validYaml.replace("malicious-code", type);
      const report = validateThreatYaml(yaml, "test.yml", []);
      const typeCheck = report.results.find(
        (r) => r.check === "threat-type-enum"
      );
      expect(typeCheck?.pass).toBe(true);
    }
  });

  it("rejects description over 200 chars", () => {
    const longDesc = "A".repeat(201);
    const yaml = validYaml.replace(
      "Steals npm tokens and AWS credentials via postinstall script",
      longDesc
    );
    const report = validateThreatYaml(yaml, "test.yml", []);
    expect(report.pass).toBe(false);

    const descCheck = report.results.find(
      (r) => r.check === "description-length"
    );
    expect(descCheck?.pass).toBe(false);
    expect(descCheck?.message).toContain("201");
  });

  it("accepts description at exactly 200 chars", () => {
    const exactDesc = "A".repeat(200);
    const yaml = validYaml.replace(
      "Steals npm tokens and AWS credentials via postinstall script",
      exactDesc
    );
    const report = validateThreatYaml(yaml, "test.yml", []);
    const descCheck = report.results.find(
      (r) => r.check === "description-length"
    );
    expect(descCheck?.pass).toBe(true);
  });

  it("detects duplicates against existing threats", () => {
    const yaml = validYaml
      .replace("evil-package", "axios")
      .replace("1.0.0", "1.14.1");
    const report = validateThreatYaml(yaml, "test.yml", existingThreats);
    expect(report.pass).toBe(false);

    const dupCheck = report.results.find(
      (r) => r.check === "duplicate-check"
    );
    expect(dupCheck?.pass).toBe(false);
    expect(dupCheck?.message).toContain("axios@1.14.1");
  });

  it("passes when package exists but version is different", () => {
    const yaml = validYaml
      .replace("evil-package", "axios")
      .replace("1.0.0", "9.9.9");
    const report = validateThreatYaml(yaml, "test.yml", existingThreats);
    const dupCheck = report.results.find(
      (r) => r.check === "duplicate-check"
    );
    expect(dupCheck?.pass).toBe(true);
  });

  it("rejects invalid YAML", () => {
    const yaml = "{{{{not yaml at all::::";
    const report = validateThreatYaml(yaml, "test.yml", []);
    expect(report.pass).toBe(false);

    const parseCheck = report.results.find(
      (r) => r.check === "yaml-parse"
    );
    expect(parseCheck?.pass).toBe(false);
  });

  it("rejects YAML that parses to a non-object", () => {
    const yaml = "just a string";
    const report = validateThreatYaml(yaml, "test.yml", []);
    expect(report.pass).toBe(false);

    const parseCheck = report.results.find(
      (r) => r.check === "yaml-parse"
    );
    expect(parseCheck?.pass).toBe(false);
  });
});
