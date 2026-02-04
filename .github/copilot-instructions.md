# Copilot AI Agent Instructions for Eternum Monorepo

## Project Overview

- **Monorepo** managed with `pnpm` workspaces. Major areas:
  - `client/apps/*`: Game clients (main: `game`, mobile: `eternum-mobile`)
  - `packages/*`: Shared libraries (core logic, React, Torii, types)
  - `contracts/*`: On-chain Cairo contracts (main logic in `game/`)
  - `common/`: Shared TypeScript utilities
- **Imports** use `@bibliothecadao/` prefix for packages, e.g. `@bibliothecadao/eternum`.

## Key Workflows

- **Install**: `pnpm install` at root
- **Dev servers**: `pnpm dev` in app dirs (e.g. `client/apps/game`)
- **Build**: `pnpm build` (all), `pnpm build:landing`, `pnpm build:docs`
- **Contracts**: `cd contracts/game && scarb build` (Cairo 2.13.1, Dojo 1.8.0)
- **Test contracts**: `sozo test` (all), `sozo test -f <name>` (specific)
- **Lint/format**: `pnpm lint`, `pnpm format`, `scarb fmt` (Cairo)

## Coding Conventions

- **TypeScript/React**: 2-space indent, ES modules, `PascalCase` for components, `useCamelCase` for hooks, `kebab-case`
  for utils
- **Path aliases**: `@/` → `client/apps/game/src` (desktop), `client/apps/eternum-mobile/src` (mobile)
- **Cairo contracts**:
  - Models: `#[dojo::model]` in `src/models/<name>.cairo`, register in `src/models.cairo`
  - Systems: `#[dojo::contract]` in `src/systems/<name>/contracts.cairo`, register in `src/systems.cairo`
  - Tests: `#[cfg(test)] mod tests { mod test_<name>; }` in system module, file at
    `src/systems/<name>/tests/test_<name>.cairo`

## App-Specific Rules

- **Check for `AGENTS.md`** in `client/apps/*` for app-specific agent instructions (e.g. `client/apps/game/AGENTS.md`).
- **Game client UX/features**: Log all new features/UX changes in `src/ui/features/world/latest-features.ts` (see
  AGENTS.md for format).

## Integration & Patterns

- **Contracts**: On-chain logic in Cairo, with models/systems pattern. Register new modules in
  `models.cairo`/`systems.cairo`.
- **Config**: Use `bun` for config scripts in `config/` (see config/README.md for batching/multicall usage).
- **Scripts**: Utility scripts in `scripts/` (see scripts/README.md for usage, e.g. weekly summary generator).
- **MMR System**: See `contracts/game/src/systems/mmr/README.md` for on-chain rating architecture.

## Best Practices

- Always follow the structure and registration patterns for new models/systems.
- Use the documented commands for builds, tests, and formatting.
- Reference app-level `AGENTS.md` and feature logs for client changes.
- Prefer existing shared libraries and patterns over new abstractions.

---

For more, see:

- [CLAUDE.md](../../CLAUDE.md) (AI/Claude-specific guidance)
- [client/apps/game/AGENTS.md](../../client/apps/game/AGENTS.md) (game client agent rules)
- [scripts/README.md](../../scripts/README.md) (utility scripts)
- [config/README.md](../../config/README.md) (config deployment)
- [contracts/game/src/systems/mmr/README.md](../../contracts/game/src/systems/mmr/README.md) (MMR system)
