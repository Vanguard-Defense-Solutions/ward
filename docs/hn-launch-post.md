# HN Post

**Title:** Ward – Open-source supply chain security for AI-assisted developers

**URL:** https://github.com/Vanguard-Defense-Solutions/ward

**Text (for Show HN — paste into the text field):**

Two days ago, axios@1.14.1 was published to npm with a hidden RAT that stole SSH keys and cloud credentials from developer machines. The maintainer's account was hijacked. The malicious version was live for 12+ hours before advisories caught up. Millions of weekly downloads.

I run a defense subcontractor (Vanguard Defense Solutions). When I saw the r/ClaudeAI post warning about it, I checked my own machine — clean, but only by luck. No tool I had would have caught it in real time.

So I built one.

**Ward** hooks into your package manager (npm, bun, yarn) and checks every package before install scripts execute. It runs locally in <200ms. No account needed. No cloud required.

What it catches:
- Known malicious packages (blocks with plain English explanation + safe version)
- Typosquats (warns when "axxios" looks like "axios")
- Suspicious install scripts (flags unknown postinstall hooks)
- Version anomalies (unexpected major jumps)

```
$ npm install axios@1.14.1
✗ ward: BLOCKED
  This version steals SSH keys and cloud credentials
  Safe version: 1.14.0
```

The threat database ships with 42 verified attacks from 2018-2026 (axios, event-stream, ua-parser-js, colors/faker, Solana web3.js, the Shai-Hulud worm, and more). A daily GitHub Action syncs new advisories automatically. Community submissions welcome via PR.

Built for AI-assisted development specifically — when Claude Code or Cursor runs `npm install` on your behalf, Ward is screening it. There's a Claude Code hook that intercepts every install command before it executes.

Split intelligence model: fast local checks for 95% of installs, optional cloud API for deep analysis (behavioral sandboxing, AI code review). Free tier is the full local engine — unlimited, forever.

Tech: TypeScript, bun, SQLite, Ed25519-signed threat DB. MIT licensed. 271 tests + 124 BDD scenarios.

Install: `bun install -g wardshield && ward init`

I'd love feedback on the detection approach, the threat model, and what's missing. Happy to answer questions about the architecture.
