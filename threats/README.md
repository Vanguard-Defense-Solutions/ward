# Community Threat Submissions

Ward's threat database is community-maintained. Anyone can submit a PR to add a new supply chain threat.

## What qualifies

Ward tracks **verified supply chain attacks** against npm packages. This includes:

- Account takeovers (hijacked maintainer credentials)
- Malicious code injected via compromised packages
- Typosquats designed to steal credentials or install malware
- Cryptominers, backdoors, and credential stealers

This does **not** include:

- Regular CVEs (use `npm audit` for those)
- Prototype pollution, ReDoS, or other code-quality vulnerabilities
- Packages that are merely abandoned or unmaintained

## How to submit

1. Fork this repository
2. Copy `threats/template.yml` to `threats/submissions/<package_name>-<version>.yml`
3. Fill in all required fields (see format below)
4. Open a PR using the **Threat Submission** PR template
5. A GitHub Action will validate your YAML automatically
6. Maintainers review and merge approved submissions

Once merged, another Action converts your YAML into the canonical `seed-threats.json` format and archives the submission file.

## YAML format

```yaml
# Threat Submission
package_name: "event-stream"
version: "3.3.6"
threat_type: "backdoor"  # One of: malicious-code | credential-theft | cryptominer | backdoor | typosquat
description: "Attacker gained maintainer access. Added encrypted payload targeting Bitpay Copay wallet"
safe_version: "3.3.5"    # Last known safe version, or "none" if always malicious
detected_at: "2018-11-26T00:00:00Z"  # ISO 8601 date

# Evidence (at least one required)
references:
  - url: "https://blog.npmjs.org/post/180565383195/details-about-the-event-stream-incident"

# Submitter
submitted_by: "your-github-username"
```

### Required fields

| Field | Description |
|---|---|
| `package_name` | The npm package name (scoped names like `@scope/pkg` are fine) |
| `version` | The specific compromised version |
| `threat_type` | One of: `malicious-code`, `credential-theft`, `cryptominer`, `backdoor`, `typosquat` |
| `description` | Plain English explanation of what the threat does. Under 200 characters. |
| `safe_version` | The last safe version before the compromise, or `"none"` if the package was always malicious |
| `detected_at` | ISO 8601 date when the threat was discovered |
| `references` | At least one URL linking to an advisory, blog post, or GitHub issue |
| `submitted_by` | Your GitHub username |

### Tips for good descriptions

- Write in plain English, not CVE jargon
- Say what the malware actually does: "Steals npm tokens and AWS credentials" not "Executes arbitrary code"
- Keep it under 200 characters
- Mention the attack vector if known: "Account hijacked", "Typosquat of lodash", etc.

## Review process

All submissions are reviewed by maintainers before merging. We check:

- The threat is real and verified by at least one independent source
- The description is accurate and helpful
- The entry is not a duplicate of something already in the database
- The `safe_version` is correct

Submissions that don't meet these criteria will receive feedback on the PR.
