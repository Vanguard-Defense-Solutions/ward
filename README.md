# Ward

[![Warded](https://img.shields.io/badge/supply%20chain-Warded-blue?logo=data:image/svg%2bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDE2IDE2Ij48cGF0aCBkPSJNOCAxbC02IDN2NGMwIDQuNCAyLjYgOC41IDYgOS45IDMuNC0xLjQgNi01LjUgNi05Ljl2LTR6IiBmaWxsPSIjM2I4MmY2Ii8+PC9zdmc+)](https://github.com/Vanguard-Defense-Solutions/ward)
[![MIT License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![npm](https://img.shields.io/npm/v/wardshield)](https://www.npmjs.com/package/wardshield)
[![Tests](https://img.shields.io/badge/tests-286%20passing-brightgreen)]()
[![Threat Feed](https://img.shields.io/badge/threat%20feed-live-red)](https://wardshield.com)

**Supply chain defense for AI-assisted developers.**

Ward sits between your AI coding assistant and the package registry. When Claude Code, Cursor, or Copilot tries to install a package, Ward checks it first — and blocks it if it's malicious.

On March 31, 2026, `axios@1.14.1` was published to npm with a hidden RAT that stole SSH keys and cloud credentials from developer machines. It was live for 12+ hours before advisories caught up. Ward was built so that doesn't happen again.

## Install

```bash
npm install -g wardshield    # Node.js
bun install -g wardshield    # bun
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

Ships with 42 verified real-world attacks (2018-2026). Browse them at [wardshield.com](https://wardshield.com).

## How it works

Ward uses a **split intelligence** model:

- A **local engine** handles fast checks (threat DB lookup, typosquat detection, install script flagging) — works offline, adds <200ms to installs
- A **cloud API** at [api.wardshield.com](https://api.wardshield.com/health) handles deep analysis — behavioral sandboxing, AI-powered code review, maintainer reputation scoring

The local engine covers 95%+ of installs. The cloud is only called for packages Ward can't resolve locally.

**Cloud API endpoints:**
- `GET` [/threats](https://api.wardshield.com/threats) — public threat feed (JSON)
- `POST` [/check](https://api.wardshield.com/check) — check a package
- `GET` [/sync](https://api.wardshield.com/sync) — Ed25519-signed threat DB sync
- `GET` [/score/:package](https://api.wardshield.com/score/axios) — package trust score

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

- [wardshield.com](https://wardshield.com) — live threat feed
- [GitHub](https://github.com/Vanguard-Defense-Solutions/ward) — source code
- [npm](https://www.npmjs.com/package/wardshield) — package
- [API](https://api.wardshield.com/health) — cloud endpoints

## Badge

Show that your project is protected. Add this to your README:

```markdown
[![Warded](https://img.shields.io/badge/supply%20chain-Warded-blue?logo=data:image/svg%2bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDE2IDE2Ij48cGF0aCBkPSJNOCAxbC02IDN2NGMwIDQuNCAyLjYgOC41IDYgOS45IDMuNC0xLjQgNi01LjUgNi05Ljl2LTR6IiBmaWxsPSIjM2I4MmY2Ii8+PC9zdmc+)](https://github.com/Vanguard-Defense-Solutions/ward)
```

## Security Disclaimer

Ward is a defense-in-depth tool that reduces your exposure to supply chain attacks. It is **not a guarantee of protection.** No security tool catches everything.

- Ward's threat database is only as current as its last sync. Zero-day attacks may not be detected until the database is updated.
- Typosquat detection uses heuristic matching and may produce false positives or miss novel patterns.
- Ward does not replace professional security audits, penetration testing, or a comprehensive security program.
- The authors and Vanguard Defense Solutions assume no liability for damages resulting from malicious packages that Ward fails to detect.

Use Ward as one layer in your security posture, not your only layer.

## License

MIT
