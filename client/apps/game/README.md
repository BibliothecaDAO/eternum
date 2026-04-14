# Game App

This is the main Eternum game client, built with React, TypeScript, Vite, and Three.js.

## Running Locally

Use one of the checked-in local env templates as your starting point:

- `./.env.local.blitz.sample` for the Blitz client flow
- `./.env.local.eternum.sample` for the Eternum client flow
- `./.env.local.tracing.example` for local tracing and observability wiring

Typical local setup:

1. Copy the sample that matches the mode you want to run to `./.env.local`.
2. Update `VITE_PUBLIC_TORII` and `VITE_PUBLIC_NODE_URL` for your target environment.
3. Start the app with `pnpm run dev`.

From the repo root, the equivalent command is:

```bash
pnpm dev
```

## Code Map

This is a high-level ownership map, not an exhaustive directory listing.

### Runtime And Platform

- `src/game-entry`, `src/play`, `src/init`: boot flow and route entrypoints
- `src/runtime`, `src/services`, `src/config`: runtime world wiring, service clients, and environment-specific config
- `src/dojo`, `src/hooks`, `src/workers`: onchain data access, app state hooks, and background workers

### Rendering And Simulation

- `src/three`: worldmap scenes, managers, effects, shaders, and rendering systems
- `src/audio`: sound engine providers, hooks, and audio UI
- `src/automation`, `src/managers`, `src/tracing`: automation helpers, runtime managers, and observability

### UI Layer

- `src/ui/design-system`: reusable atoms and molecules
- `src/ui/features`: domain modules such as `economy`, `military`, `world`, `settlement`, `social`, `factory-v2`,
  `market`, `relics`, and `progression`
- `src/ui/modules`: cross-cutting UI modules such as settings, shortcuts, boot loading, and entity details
- `src/ui/layouts`, `src/ui/shared`, `src/ui/components`: app layouts and shared presentation primitives

## Related Docs

- Repo overview: [`README.md`](../../../README.md)
- Repo docs index: [`docs/README.md`](../../../docs/README.md)
- Player/dev docs site: [`client/apps/game-docs/README.md`](../game-docs/README.md)
