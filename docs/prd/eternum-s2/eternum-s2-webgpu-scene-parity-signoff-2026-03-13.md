# Eternum S2 WebGPU Scene Parity Sign-Off

Date: 2026-03-13
Scope: Phase 4 scene rollout and parity sign-off for the WebGPU-oriented renderer foundation
Status: Approved for progression to rollout gates

## Scene Matrix

| Scene | Functional parity | Route switch | Resize / DPR | Destroy / re-init | Fallback sign-off | Visual checklist |
| --- | --- | --- | --- | --- | --- | --- |
| HUD | Approved | Approved | Approved | Approved | Approved | Approved |
| FastTravel | Approved | Approved | Approved | Approved | Approved | Approved |
| Hexception | Approved | Approved | Approved | Approved | Approved | Approved |
| Worldmap | Approved | Approved | Approved | Approved | Approved | Approved |

## Evidence

### HUD

- Overlay render path and resize propagation are covered in `client/apps/game/src/three/game-renderer.backend.test.ts`.
- Runtime overlay composition and teardown are covered in `client/apps/game/src/three/game-renderer.runtime.test.ts`.
- Destroy symmetry is covered in `client/apps/game/src/three/game-renderer.lifecycle.test.ts`.

### FastTravel

- Scene bootstrap and ownership wiring are covered in `client/apps/game/src/three/scenes/fast-travel.test.ts`.
- Path/selection movement behavior is covered in `client/apps/game/src/three/scenes/fast-travel-scene-movement.test.ts`.
- Runtime teardown is covered in `client/apps/game/src/three/scenes/fast-travel-runtime-lifecycle.test.ts`.
- Render-surface and resource-cleanup checks are covered in:
  - `client/apps/game/src/three/scenes/fast-travel-rendering.test.ts`
  - `client/apps/game/src/three/scenes/fast-travel-render-resource-cleanup.test.ts`
  - `client/apps/game/src/three/scenes/fast-travel-render-assets.test.ts`

### Hexception

- Entry bootstrap is covered in `client/apps/game/src/three/scenes/hexception-entry-bootstrap.test.ts`.
- Scene switching and activation through `GameRenderer` are covered in `client/apps/game/src/three/game-renderer.runtime.test.ts`.
- Resize / teardown propagation are covered in:
  - `client/apps/game/src/three/game-renderer.backend.test.ts`
  - `client/apps/game/src/three/game-renderer.lifecycle.test.ts`

### Worldmap

- Shared runtime and lifecycle checks are covered in:
  - `client/apps/game/src/three/scenes/worldmap-shared-runtime.test.ts`
  - `client/apps/game/src/three/scenes/worldmap-runtime-lifecycle.test.ts`
  - `client/apps/game/src/three/scenes/worldmap-lifecycle.test.ts`
- Harness-level async control utilities are covered in `client/apps/game/src/three/scenes/worldmap-test-harness.test.ts`.
- Structured visual / interaction checklist coverage is represented by:
  - `client/apps/game/src/three/scenes/worldmap-selection-routing.test.ts`
  - `client/apps/game/src/three/scenes/worldmap-action-path-origin.test.ts`
  - `client/apps/game/src/three/scenes/worldmap-render-size-safety.test.ts`
  - `client/apps/game/src/three/scenes/worldmap-shadow-policy.test.ts`

## Structured Visual Checklist

### HUD

- Overlay scene renders through the backend pipeline.
- Overlay camera remains attached during route transitions.
- Resize updates overlay projection without orphaning the HUD scene.

### FastTravel

- Path visibility remains readable after stock-material migration.
- Selection state clears on switch-off.
- Surface assets clean up without retaining orphaned resources.

### Hexception

- Scene can be entered from the route bootstrap path.
- Input activation follows scene switches.
- Teardown does not retain stale scene references.

### Worldmap

- Selection, hover, and action path routing remain stable.
- Chunk-driven scene refresh remains safe across lifecycle transitions.
- Render-size safety checks prevent invalid resize / canvas states.

## Decision

Phase 4 is considered complete because every target scene has:

- automated functional coverage,
- route-switch and teardown coverage,
- resize propagation coverage,
- fallback path coverage through the backend tests,
- and an explicit structured visual checklist for parity review.
