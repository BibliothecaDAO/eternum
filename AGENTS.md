# Repository Guidelines

## Project Structure & Module Organization

The monorepo is managed with `pnpm` workspaces. Game clients live under `client/apps`, with `client/apps/game` as the
primary Blitz experience and `client/apps/eternum-mobile` for mobile. Cross-project libraries live in `packages/*` (core
logic, React bindings, Torii integrations, type defs), imports are done with `@bibliothecadao/` prefix, example:
`@bibliothecadao/eternum` for the core library, `@bibliothecadao/torii` for the Torii library, etc. On-chain Cairo
contracts and deployment scripts are grouped in `contracts/*`, with environment files in `contracts/common`. Shared
TypeScript utilities for both client and contracts reside in `common/`.

## Build, Test & Development Commands

Run `pnpm install` once at the workspace root. Use `pnpm dev` for the Blitz client (`client/apps/game`) and `pnpm dev`
for the mobile client (`client/apps/eternum-mobile`). Production bundles come from `pnpm build`, and landing/docs builds
use `pnpm build:landing` or `pnpm build:docs`. Launch the full local stack with `pnpm run contract:start:local`; stop it
via `pnpm run contract:stop:local`. When iterating on packages, prefer `pnpm --dir packages/<name> build` to verify
TypeScript output.

## Coding Style & Naming Conventions

TypeScript and React use two-space indentation and ES module imports. Components and hooks follow `PascalCase` and
`useCamelCase` naming, while utility files stay `kebab-case`. Path aliases like `@/` resolve to `client/apps/game/src`
in desktop and `client/apps/eternum-mobile/src` in mobile. Run `pnpm --dir client/apps/game lint` before sending
patches; fixable issues can be auto-corrected with `lint:fix`. Formatting is enforced through Prettier (`format` /
`format:check`).

## Mobile Specific Guidelines

- Use `client/apps/eternum-mobile/README.md` for mobile specific guidelines.
- Tech stack: React.ts, shadcn/ui, tailwind, pnpm, vite.
- Configured path for installed shadcn components is: `@/shared/ui`.
- Use kebab-case for file names.
- Prefer to use shadcn/ui elements when it's possible.
- UI/UX must be optimized for mobile devices with touch screns.
- Prefer to use interfaces over types.
- We are using Feature-Sliced Design architecture in project.
- When creating new pages/widgets be sure that it has `index.ts` with all the exports.
- Dont add custom css classes unless they are necessary.
- Don't create huge components, divide it into smaller parts where it's appropriate. App-level reusable components place
  into `src/shared` folder.

## Commit & Pull Request Guidelines

Follow the active history style: concise, present-tense prefixes such as `fix:`, `feat:`, or `chore:` describe intent
(see `git log --oneline`). Group related work into focused commits and reference issue IDs when they exist. Pull
requests should outline scope, testing evidence (`pnpm lint`, `pnpm test`, local network notes), and attach screenshots
or recordings for UI-visible changes. Flag contract migrations or schema updates explicitly so reviewers can sync their
environments.
