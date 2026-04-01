# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Ward, **please do not open a public GitHub issue.** Instead, report it responsibly via email:

**Email:** [security@vanguarddefensesolutions.com](mailto:security@vanguarddefensesolutions.com)

Include as much detail as possible: steps to reproduce, affected versions, and potential impact.

## Response Timeline

- **Acknowledgment:** within 48 hours of your report
- **Triage:** within 1 week we will assess severity and confirm whether the issue is valid
- **Fix:** timeline depends on severity, but we aim to ship patches for critical issues within 72 hours of triage

## Scope

The following are **in scope** for security reports:

- Ward CLI (`wardshield` npm package)
- Ward API server (`packages/api`)
- GitHub Actions workflows in this repository
- `ward-hook` (Claude Code hook script)

The following are **out of scope:**

- The wardshield.dev website (not yet built)
- Third-party dependencies (report vulnerabilities to their respective maintainers)
- Reports of malicious npm packages -- these should be submitted through the [community threat submission process](https://github.com/Vanguard-Defense-Solutions/ward/tree/main/threats)

## What to Report

We are interested in vulnerabilities in Ward itself, such as:

- Bypass of package blocking or threat detection
- Signature verification flaws
- Command injection or path traversal in the CLI or hooks
- Authentication or authorization issues in the API
- CI/CD pipeline vulnerabilities

## Safe Harbor

Vanguard Defense Solutions will **not** pursue legal action against security researchers who:

- Act in good faith to discover and report vulnerabilities
- Avoid accessing or modifying other users' data
- Do not publicly disclose the vulnerability before we have had a reasonable opportunity to fix it

## Credit

Researchers who report valid vulnerabilities will be credited in the project changelog and release notes, with their permission.

## PGP Key

A PGP key for encrypted communication will be published here in a future update.
