# Eternum Documentation

This directory holds internal architecture notes, PRDs, plans, and roadmap documents for the repository.

## Start Here

- Repo overview: [`README.md`](../README.md)
- Contributing: [`CONTRIBUTING.md`](../CONTRIBUTING.md)
- Packages index: [`packages/README.md`](../packages/README.md)
- Game client README: [`client/apps/game/README.md`](../client/apps/game/README.md)
- Docs app README: [`client/apps/game-docs/README.md`](../client/apps/game-docs/README.md)
- Deployment notes: [`deploy/README.md`](../deploy/README.md)
- Config notes: [`config/README.md`](../config/README.md)

## Doc Homes

- Player-facing and developer-facing product docs live in [`client/apps/game-docs`](../client/apps/game-docs).
- Repo-level architecture notes, plans, and PRDs live in this `docs/` folder.

## In This Folder

### Architecture

- AI-first harness architecture:
  [`docs/architecture/ai-first-harness-architecture.md`](./architecture/ai-first-harness-architecture.md)

### Plans

- Factory wiring: [`docs/plans/factory-wiring.md`](./plans/factory-wiring.md)
- Factory v2: [`docs/plans/factory-v2.md`](./plans/factory-v2.md)
- Factory v2 prize funding visibility:
  [`docs/plans/factory-v2-prize-funding-visibility.md`](./plans/factory-v2-prize-funding-visibility.md)
- Factory series launches prizes:
  [`docs/plans/factory-series-launches-prizes.md`](./plans/factory-series-launches-prizes.md)

### PRDs

- Coarse default tick regression:
  [`docs/prd-coarse-default-tick-regression.md`](./prd-coarse-default-tick-regression.md)
- Entry route and network switch hardening:
  [`docs/prd-entry-route-and-network-switch-hardening.md`](./prd-entry-route-and-network-switch-hardening.md)
- Loading stall recovery: [`docs/prd-loading-stall-recovery.md`](./prd-loading-stall-recovery.md)
- Player first load world map: [`docs/prd-player-first-load-world-map.md`](./prd-player-first-load-world-map.md)
- Worldmap interactivity readiness:
  [`docs/prd-worldmap-interactivity-readiness.md`](./prd-worldmap-interactivity-readiness.md)

### Roadmaps

- Realtime roadmap: [`docs/roadmap/realtime.md`](./roadmap/realtime.md)

## Running The Docs Site Locally

The docs site is the Vocs app at [`client/apps/game-docs`](../client/apps/game-docs).

From the repo root:

```bash
pnpm install
pnpm dev:docs
```

From the docs app directory:

```bash
cd client/apps/game-docs
pnpm run dev
```
