# Ward

**Supply chain defense for AI-assisted developers.**

Ward sits between your AI coding assistant and the package registry. When Claude Code, Cursor, or Copilot tries to install a package, Ward checks it first — and blocks it if it's malicious.

On March 31, 2026, `axios@1.14.1` was published to npm with a hidden RAT that stole SSH keys and cloud credentials from developer machines. It was live for 12+ hours before advisories caught up. Ward was built so that doesn't happen again.

## Install

```bash
bun install -g wardshield
ward init
```

That's it. Ward hooks into your package manager and runs transparently on every install.

## What it does

```
$ npm install express
✓ ward: clean

$ npm install axios@1.14.1
✗ ward: BLOCKED
  This version steals SSH keys and cloud credentials
  Safe version: 1.14.0

$ npm install axxios
⚠ ward: suspicious
  Looks similar to "axios" — did you mean "axios"?
  Proceed anyway? [y/N]
```

Ward checks every package you install against four detection layers:

- **Known threat database** — blocks packages with confirmed malware, backdoors, or credential stealers
- **Typosquat detection** — warns when a package name is suspiciously similar to a popular package
- **Install script analysis** — flags packages with unknown preinstall/postinstall scripts
- **Version anomaly detection** — catches unexpected major version jumps and non-existent versions

Checks run locally in <200ms. No cloud required. No account required. Just protection.

## How it works

Ward uses a **split intelligence** model:

- A **local engine** handles fast checks (threat DB lookup, typosquat detection, install script flagging) — works offline, adds <200ms to installs
- A **cloud API** (optional) handles deep analysis — behavioral sandboxing, AI-powered code review, maintainer reputation scoring

The local engine covers 95%+ of installs. The cloud is only called for packages Ward can't resolve locally.

## Output modes

```bash
ward scan                  # check all project dependencies
ward scan --json           # JSON output for CI/CD
ward --clinical scan       # technical output (threat types, no prose)
ward --verbose scan        # show all signals, check times
ward status                # protection summary
```

## Configuration

Ward creates a `.wardrc` in your project:

```json
{
  "sensitivity": "normal",
  "allowlist": [],
  "cloudEnabled": true
}
```

**Sensitivity levels:**
- `strict` — warnings become blocks (zero tolerance)
- `normal` — known threats blocked, suspicious packages warned (default)
- `permissive` — only known threats blocked, everything else allowed

## For teams

Ward's cloud dashboard (coming soon) adds:

- **Shared threat intelligence** — when Ward blocks a package for one developer, the whole team is protected instantly
- **Policy enforcement** — team leads define rules ("no packages with install scripts unless allowlisted")
- **Audit trail** — every install logged with who, what, when, and Ward's verdict
- **Real-time alerting** — Slack/email alerts when a new threat affects your dependency tree

## Built by Vanguard Defense Solutions

Ward is built by [Vanguard Defense Solutions](https://vanguarddefensesolutions.com) — supply chain defense from people who do defense for a living.

## Security Disclaimer

Ward is a defense-in-depth tool that reduces your exposure to supply chain attacks. It is **not a guarantee of protection.** No security tool catches everything.

- Ward's threat database is only as current as its last sync. Zero-day attacks may not be detected until the database is updated.
- Typosquat detection uses heuristic matching and may produce false positives or miss novel patterns.
- Ward does not replace professional security audits, penetration testing, or a comprehensive security program.
- The authors and Vanguard Defense Solutions assume no liability for damages resulting from malicious packages that Ward fails to detect.

Use Ward as one layer in your security posture, not your only layer.

## License

MIT
