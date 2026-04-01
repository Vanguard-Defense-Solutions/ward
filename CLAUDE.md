# CLAUDE.md

## Ward — AI Development Safety Platform

### Commands
- `bun install` — install all workspace dependencies
- `bun test` — run all tests (unit + integration + e2e)
- `bun run test:unit` — unit tests only
- `bun run test:e2e` — e2e tests only
- `bun run build` — build all packages
- `bun run lint` — typecheck

### Architecture
Monorepo with bun workspaces:
- `packages/shared/` — types, local engine, threat DB, scoring
- `packages/cli/` — CLI commands, PM hooks, user-facing output
- `packages/api/` — Phase 1b cloud API (Hono), serves /check, /sync, /score, /threats

### Test patterns
- Tests live next to source: `src/engine/threat-db.test.ts`
- E2E tests in `packages/cli/test/e2e/`
- BDD: red/green/refactor for every feature
- Every user story has unit + integration + e2e coverage

### Design
See DESIGN.md for colors, typography, CLI output format, anti-slop directives.
