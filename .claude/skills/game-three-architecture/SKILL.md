---
name: game-three-architecture
description:
  Use when building, refactoring, reviewing, or debugging the Eternum game client renderer, especially
  client/apps/game/src/three, world map, scenes, managers, hydration, chunking, terrain, labels, FX, or gameplay
  presentation code.
---

# Eternum Game Three Architecture

Use this skill before changing the game renderer. Three.js is the drawing backend, not the application architecture.

## First Principles

- Render from resolved state: `domain state -> presentation state -> render plans -> Three.js objects`.
- Scenes own camera, picking, scene graph roots, scene lifecycle, and input surfaces.
- Scenes do not own gameplay rules, account lookup, transactions, React modals, toasts, chain-time policy, or ECS
  hydration policy.
- Render managers render one category: terrain, armies, structures, chests, labels, FX.
- Render managers consume explicit render plans and narrow environment interfaces. They must not read app stores or
  depend on concrete scenes.
- Stateful async systems are runtimes: hydration, prefetch, terrain presentation, optimistic movement, reconnect
  recovery, diagnostics.
- Policy helpers should be pure where possible. Stateful orchestration belongs in named runtime objects.
- Shared constants and geometry policy must have one source of truth.
- Most world-map behavior should be testable without WebGL or a Three `Scene`.

## Preferred Boundaries

- `WorldmapScene`: coordinates scene lifecycle, input, camera, and renderer application.
- `WorldmapCommandController`: validates and submits gameplay commands; owns account lookup, stamina checks, tx
  lifecycle, toasts, and modals.
- `WorldmapInteractionController`: turns pointer/keyboard input into domain intents.
- `WorldmapHydrationRuntime`: owns render-area hydration, pending/completed fetches, retention, and recovery.
- `WorldmapTerrainRuntime`: owns terrain cache, visual pages, matrix preparation, and presentation composition.
- `WorldmapEntityPresentationRuntime`: converts domain entities into army, structure, chest, label, and FX render plans.
- `ArmyRenderer`, `StructureRenderer`, `ChestRenderer`, `TerrainRenderer`, `LabelRenderer`, `FxRenderer`: apply plans
  and update frame-local animation only.

## Do Not

- Do not shrink large files by moving random methods to helper files while leaving ownership unchanged.
- Do not add more global-store reads inside Three scenes or managers.
- Do not open React modals or emit toasts directly from render managers.
- Do not let managers depend on `HexagonScene`, `WorldmapScene`, or `SceneManager` when a narrow interface is enough.
- Do not make renderers infer domain truth from ECS, account state, or UI state.
- Do not duplicate chunk, bounds, visibility, or fetch-key logic.
- Do not optimize a tangled path before separating command, hydration, terrain, and rendering responsibilities.

## Review Checklist

Before finishing game renderer work, verify:

1. Can the top-level scene flow be understood without reading helper bodies?
2. Did gameplay command logic stay outside Three renderers?
3. Did UI feedback stay outside render managers?
4. Are async state machines owned by named runtimes instead of the scene class?
5. Do managers receive explicit plans or narrow interfaces instead of reading global state?
6. Is chunk geometry/fetch/visibility policy centralized?
7. Can the changed behavior be tested without WebGL when it is not pixel-specific?
