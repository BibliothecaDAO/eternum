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
- Chain and box infrastructure (the self-hosted Madara L3): [`deploy/athanor/README.md`](../deploy/athanor/README.md)
- Environment setup, deploy and season operations: [operator runbook](../deploy/first/README.md)
- Alerts and what to do about each: [on-call runbook](../deploy/first/ON-CALL.md)
- Balance sources and generated presets: [`config/source`](../config/source) and
  [`config/generated`](../config/generated); regenerate with `pnpm run config:generate`
- Herald (block folding, snapshots, ordered diffs): [`apps/herald/README.md`](../apps/herald/README.md)
- Launch service: [`apps/launch-service/README.md`](../apps/launch-service/README.md)
- Contracts: [`contracts/l3/world-native`](../contracts/l3/world-native) (native game domains) and
  [`contracts/l2`](../contracts/l2) (ledger, tokens, collectibles)
- Packages and SDK: [`packages/README.md`](../packages/README.md)
- Game client: [setup](../apps/game/README.md), [renderer](../apps/game/src/three/README.md),
  [features and connected proofs](../apps/game/FEATURE-MAP.md) and [lab tools](../apps/game/src/lab/README.md)

### Architecture and verification

- [Workflow responsibilities](./architecture/ai-first-harness-architecture.md)
- [Herald fold and recovery](../apps/herald/README.md) and [shared native client](../packages/core/readme.md)
- [Procedural character pipeline](./architecture/procedural-character-pipeline.md): model onboarding and promotion
- [Motion evaluation](./architecture/animation-evaluation.md),
  [frame inspector](./architecture/procedural-animation-frame-inspector.md) and
  [character performance gate](./architecture/procedural-character-performance-evaluation.md)
- [Native toolchain](../contracts/l3/world-native/TOOLCHAIN.md); final-tree validation:
  `bash contracts/l3/check-native.sh`
- [AMMv2 contracts and fees](../contracts/l2/ammv2/README.md)

### Retained design work

These documents retain unresolved scope or decisions. They are historical proposals, not current deployment or player
instructions; consult the component guides above for shipped behavior.

- [Hired-player architecture](./plans/hired-agents-architecture-brief.md) and
  [milestones](./plans/hired-agents-milestones.md)
- [Mobile scope](./plans/mobile-client-scope.md)
- Chat scope remains in the [retained plans directory](./plans).
- [Value-plane decisions](./plans/realms-value-plane-design.md) and
  [open audit dispositions](./plans/value-plane-loop-audit-2026-08-31.md)
- [Character source pipeline decisions](./architecture/procedural-character-model-generation-pipeline-research.md)

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
