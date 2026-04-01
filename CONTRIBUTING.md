# Contributing to Ward

Thanks for helping make the npm ecosystem safer.

## Setup

```bash
git clone https://github.com/Vanguard-Defense-Solutions/ward.git
cd ward
bun install
bun test          # 286 tests, should all pass
bun run test:bdd  # 124 Cucumber scenarios
```

## Project Structure

```
packages/
  shared/   # Types, local engine, threat DB, sync client
  cli/      # CLI commands, PM hooks, output formatting
  api/      # Cloud API server (Hono)
features/   # BDD Gherkin scenarios + step definitions
scripts/    # Advisory sync, threat validation, DB signing
threats/    # Community threat submissions
```

## Making Changes

1. Create a branch: `git checkout -b your-feature`
2. Write a failing test first (TDD)
3. Implement the minimum to make it pass
4. Run `bun test` and `bun run test:bdd`
5. Commit with a descriptive message
6. Open a PR against `main`

## Submitting Threats

Found a malicious npm package? See [threats/README.md](threats/README.md) for how to submit it via PR. You don't need to write code — just fill out a YAML file.

## Code Standards

- TypeScript, strict mode
- Tests live next to source (`engine.test.ts` beside `engine.ts`)
- E2E tests in `packages/cli/test/e2e/`
- BDD scenarios in `features/`
- No adding deps without a good reason (we have 4 production deps — keep it tight)
- This is a security product. Think about how your change could be exploited.

## Security

Found a vulnerability in Ward itself? **Do not open a public issue.** See [SECURITY.md](SECURITY.md) for responsible disclosure.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
