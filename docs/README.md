# Eternum documentation (repo index)

This page maps the documentation inside this repository.

## Players and community

Player-facing docs live in [`apps/game-docs`](../apps/game-docs) and are published at
[docs.realms.world](https://docs.realms.world).

## Developers

Read [`AGENTS.md`](../AGENTS.md) first. It is the coding and review standard for the whole repository. Then read the
`AGENTS.md` of the directory you are working in, for example [`apps/game/AGENTS.md`](../apps/game/AGENTS.md).

### Where things live

- Contributing: [`CONTRIBUTING.md`](../CONTRIBUTING.md)
- Chain and box infrastructure (the self-hosted Madara L3):
  [`deploy/madara-lab/README.md`](../deploy/madara-lab/README.md)
- Game launch and balance config: [`config/deployer/clean/README.md`](../config/deployer/clean/README.md) and
  [`config/README.md`](../config/README.md)
- Herald (block folding, snapshots, ordered diffs): [`apps/herald/README.md`](../apps/herald/README.md)
- Launch service: [`apps/launch-service/README.md`](../apps/launch-service/README.md)
- Contracts: [`contracts/l3`](../contracts/l3) (game world and factory) and [`contracts/l2`](../contracts/l2) (ledger,
  tokens, collectibles)
- Packages and SDK: [`packages/README.md`](../packages/README.md)
- Game client: [`apps/game/README.md`](../apps/game/README.md) and
  [`apps/game/src/three/README.md`](../apps/game/src/three/README.md)

### Architecture (`docs/architecture`)

- [AI-first harness architecture](./architecture/ai-first-harness-architecture.md)
- [Sync S2 recovery contract](./architecture/sync-s2-recovery-contract.md) and
  [Sync S4 recovery proofs](./architecture/sync-s4-recovery-proofs.md)
- [Procedural character pipeline](./architecture/procedural-character-pipeline.md): model onboarding, gym evaluation,
  game promotion. The `procedural-*-research.md` files beside it are the research behind it.

### Plans (`docs/plans`)

Implementation briefs. Each item states its evidence, the fix, and a verifiable gate.

- [Realms phase 1](./plans/realms-phase-1-brief.md): one repo, one login, Madara without Cartridge
- [Realms phase 2](./plans/realms-phase-2-brief.md): own the data plane, take value seriously
- [Realms phase 3, backend](./plans/realms-phase-3-backend-brief.md) with the
  [value-plane design](./plans/realms-value-plane-design.md)
- [Realms game client](./plans/realms-client-brief.md): the 96-player client rebuild and its ledger
- [Realms web app](./plans/realms-webapp-brief.md): one app for everything but the map

Codex briefs for in-flight work sit beside them as `*-codex-brief.md`. A brief is deleted once its gates are closed and
what it decided lives in code or in an architecture doc.

### Other

- [The Agora, the Eternum AMM](./agora.md)

## Running the docs site locally

The docs site lives at [`apps/game-docs`](../apps/game-docs) and is built with Vocs.

From the repo root:

```bash
pnpm install
pnpm dev:docs
```

Or from the docs app folder:

```bash
cd apps/game-docs
pnpm install
pnpm run dev
```
