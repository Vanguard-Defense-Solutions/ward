# Ward — Design System

**Owner:** Vanguard Defense Solutions
**Created:** 2026-03-31
**Status:** Active — Phase 1a

---

## Design Philosophy

Ward is invisible until it matters. The design reflects this: minimal chrome, zero noise on clean operations, maximum clarity when something is wrong. Security products earn trust through restraint, not decoration.

**Core principles:**
- Invisible on green, unmissable on red
- Human language, not CVE jargon (default; `--clinical` flag for power users)
- Terminal-native aesthetic — the users live in terminals
- Data-first, marketing-second
- Respect the developer's time and screen real estate

---

## Colors

### Terminal
| Token | Hex | Usage |
|---|---|---|
| green | #22c55e | Clean/safe verdicts |
| yellow | #eab308 | Warning/suspicious |
| red | #ef4444 | Blocked/threat |
| dim | #6b7280 | Context/detail text |

### Web — Dark Mode (default)
| Token | Hex | Usage |
|---|---|---|
| bg | #0a0a0a | Page background |
| surface | #171717 | Cards, panels |
| border | #262626 | Dividers, card borders |
| text | #fafafa | Primary text |
| muted | #a3a3a3 | Secondary text |
| accent | #3b82f6 | Links, CTAs, interactive |
| green | #22c55e | Safe states |
| yellow | #eab308 | Warning states |
| red | #ef4444 | Threat/blocked states |

### Web — Light Mode
| Token | Hex | Usage |
|---|---|---|
| bg | #fafafa | Page background |
| surface | #ffffff | Cards, panels |
| border | #e5e5e5 | Dividers, card borders |
| text | #0a0a0a | Primary text |
| muted | #6b7280 | Secondary text |
| accent | #2563eb | Links, CTAs, interactive |
| green | #16a34a | Safe states |
| yellow | #ca8a04 | Warning states |
| red | #dc2626 | Threat/blocked states |

Use CSS custom properties: `--color-bg`, `--color-surface`, etc. Theme toggle respects `prefers-color-scheme` by default.

---

## Typography

| Token | Font | Usage |
|---|---|---|
| mono | JetBrains Mono | Package names, versions, code, terminal-like content |
| sans | Inter | UI text, headings, body copy |

### Scale
| Size | px | Usage |
|---|---|---|
| xs | 12 | Timestamps, badges |
| sm | 14 | Body text, table content |
| base | 16 | Primary UI text |
| lg | 20 | Section headings |
| xl | 24 | Page headings |
| 2xl | 32 | Hero numbers (risk posture cards) |

No font sizes above 32px. This is a tool, not a marketing site.

---

## Spacing

Base unit: 4px. Scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64.

---

## Components

### Verdict Badge
Pill with colored dot + text.
- `● clean` (green dot, green text)
- `● warning` (yellow dot, yellow text)
- `● blocked` (red dot, red text)

### Threat Card
Bordered card with severity stripe on left edge.
- Left border: 3px, colored by severity (red=critical, yellow=medium, blue=info)
- Content: package name (mono), description (sans), detection time, status

### Score Gauge
Circular arc, 0-100.
- 80-100: green arc
- 50-79: yellow arc
- 0-49: red arc
- Numerical value always displayed in center (not color-only)

### Activity Row
`timestamp | actor | action | verdict badge`
- Timestamp: muted, xs, mono
- Actor: sans, sm (username or "claude-code" / "cursor")
- Action: mono (package@version)
- Verdict: badge component

---

## CLI Output Design

### Verdict Line (always first, always one line)
```
✓ ward: clean                     ← green, bold
⚠ ward: suspicious                ← yellow, bold
✗ ward: BLOCKED                   ← red, bold
```

### Context (yellow/red only, 1-3 lines)
```
  This version steals SSH keys and cloud credentials.
  New maintainer added 2h ago.
```
Dim white, 2-space indent.

### Action (yellow/red only)
```
  Proceed anyway? [y/N]           ← yellow prompt
  Safe version: 1.14.0            ← green suggestion
```

### Detail (--verbose only)
```
  Ward Score: 34/100
  Checked: threat-db, typosquat, install-scripts
  Check time: 142ms
```
Dim, 2-space indent.

### Behavioral rules:
- Respect `NO_COLOR` — disable ANSI when set
- Respect `TERM=dumb` — plain text, no escape codes
- All information conveyed by text + symbols, not just color (✓/⚠/✗)
- `--json` flag on every command for machine-readable output
- First 3 installs after `ward init` show timing (`142ms`) to prove speed, then hide it
- No ASCII art logos, banners, or "thank you" messages
- No progress bars for checks <1s; spinner only for cloud escalation

---

## Dashboard Information Architecture

### Primary: Risk Posture
Three number cards: Blocked (red) | Warnings (yellow) | Clean (green).
Subtitle: "Your team is protected. {N} installs checked today."

### Secondary: Activity Feed
Chronological list of installs with actor, package, and verdict.

### Tertiary: Tabbed management
Policies | Members | Alerts — tab navigation.

---

## Responsive Breakpoints

| Viewport | Width | Layout |
|---|---|---|
| mobile | <640px | Single column, bottom tab nav |
| tablet | 640-1024px | Two column, collapsed side nav |
| desktop | >1024px | Full layout, expanded side nav |

### Mobile specifics:
- Risk posture: horizontal scroll for 3 cards (not stacked)
- Activity feed: full width, swipe for detail
- Nav: bottom tab bar (Dashboard | Feed | Policies | Account)

---

## Accessibility

- Keyboard: all interactive elements focusable, logical tab order
- ARIA: nav, main, aside landmarks
- Touch: 44px minimum targets on mobile
- Contrast: WCAG AA (4.5:1 text, 3:1 UI components)
- Score gauge: numerical value always visible
- Screen reader: verdict badges announce status text, not just color

---

## Anti-Slop Directives

These patterns are BANNED in Ward's UI:

- No hero sections with stock imagery
- No generic 3-column feature cards with icons
- No gradient backgrounds or glassmorphism
- No "Clean, modern UI" — every element must have a reason
- No marketing language on the threat feed (it's a public utility)
- No "Star us on GitHub!" banners
- Activity feed uses monospace for package names — it should feel like terminal output
- Threat entries show real technical detail, not "a vulnerability was found"

---

## Logo

Minimal geometric shield mark. Single color. Works at all sizes (16px favicon to full dashboard). Created with `/canvas-design` during implementation. Iterate with a designer post-launch.

---

*Created by /plan-design-review on 2026-03-31*
