# Eternum S2 Frontend + Config PRD

Date: 2026-03-11 Status: Draft Branch: `aymericdelab/season-notes` Scope: Frontend and config only (contracts for S2
assumed complete)

## 1. Objective

Ship a new long-form game mode, `Eternum S2`, in the existing client while preserving `Blitz`.

This PRD covers:

- frontend game-mode architecture,
- world/lobby registration and entry UX,
- S2 map layer support,
- S2 structure and system UI surfaces,
- config/admin/deployer updates needed to run S2 worlds.

## 2. Confirmed Product Rules

- Realms in S2 construct only the resource buildings present in that Realm NFT metadata (same behavior as S0/S1).
  Confirmed by Krump on 2026-03-11.
- S2 is a multi-week mode with slower interaction loops (target around two logins/day).
- Blitz remains available as a separate mode.

## 3. Current Code Audit Summary

### 3.1 Game mode and config state

- Game mode registry only supports `standard` and `blitz`: `client/apps/game/src/config/game-modes/index.ts`.
- Mode resolution is currently tied to one bool (`blitz_mode_on`) instead of an explicit mode id.
- Shared config defaults are Blitz-like and short duration (`SEASON_DURATION_SECONDS` currently 1.5h):
  `config/environments/_shared_.ts`.
- Admin factory presets are Blitz-centric (`sandbox`, `blitz-slot`):
  `client/apps/game/src/ui/features/admin/pages/factory.tsx` and
  `client/apps/game/src/ui/features/admin/services/world-config-builder.ts`.
- Deployer game-mode config currently writes only `blitz_mode_on`: `config/deployer/config.ts` and
  `packages/provider/src/index.ts`.

### 3.2 Lobby/registration/entry state

- World availability SQL is hardcoded to Blitz fields and `s1_eternum-*` tables:
  `client/apps/game/src/hooks/use-world-availability.ts`.
- Registration hook resolves and calls `blitz_realm_systems`: `client/apps/game/src/hooks/use-world-registration.ts`.
- Entry modal settlement and forge flow calls Blitz-specific systems:
  `client/apps/game/src/ui/features/landing/components/game-entry-modal.tsx`.

### 3.3 Map/layer state

- URL, navigation, and state are 2D (`col,row`) without layer parameter: `packages/core/src/systems/position.ts`,
  `client/apps/game/src/three/utils/navigation.ts`, `client/apps/game/src/three/utils/location-manager.ts`,
  `client/apps/game/src/hooks/store/use-three-store.ts`, `packages/types/src/types/common.ts`.
- Tile format supports `alt`, but runtime still defaults heavily to `DEFAULT_COORD_ALT=false`:
  `packages/core/src/utils/tile.ts`, `packages/core/src/managers/tile-manager.ts`, multiple call sites.
- Torii map queries are currently base-layer only: `client/apps/game/src/dojo/queries.ts`.

### 3.4 Resource construction state

- Realm construction UI already uses `realm.resources` from metadata:
  `client/apps/game/src/ui/features/settlement/construction/select-preview-building.tsx`.
- Context-menu construction also uses realm metadata resource list:
  `client/apps/game/src/three/scenes/context-menu/structure-construction-menu.tsx`.
- Realm resources are unpacked from structure metadata: `packages/core/src/utils/realm.ts`.

### 3.5 Structure typing and map markers

- `StructureType` and naming currently cover only 5 categories (Realm/Hyperstructure/Bank/FragmentMine/Village):
  `packages/types/src/constants/structures.ts`.
- Minimap and structure naming paths assume that 5-type set:
  `client/apps/game/src/ui/features/world/components/bottom-right-panel/hex-minimap.tsx` and
  `packages/core/src/utils/structure.ts`.

## 4. Product Requirements (Frontend + Config)

### R1. Add explicit `Eternum S2` mode in client architecture

- Add `s2` mode config alongside `blitz`.
- Remove boolean-only mode resolution and resolve mode via explicit world mode metadata/config.
- Keep Blitz behavior unchanged.

Acceptance criteria:

- Client can detect and render correct mode for Blitz and S2 worlds.
- No Blitz regressions in labels/assets/rules.

### R2. Make lobby, registration, and entry flow mode-aware

- Replace Blitz-only availability query with mode/capability-based world metadata.
- Split registration pipeline by mode.
- Keep Blitz token/registration flow intact.
- Implement S2 entry path using S2 systems only.

Acceptance criteria:

- Player can join Blitz world through existing flow.
- Player can join S2 world without Blitz-only blockers.
- No Blitz system calls are executed for S2 join flow.

### R3. Implement S2 multi-layer map support

- Introduce layer-aware position type (`col,row,alt` or equivalent).
- Add URL/state/navigation support for active layer.
- Update map fetch/query/stream paths to include layer discriminator.
- Add layer-switch interaction around Spires and transition UX.
- Support cross-layer occupancy conflict prompt from spire travel results.

Acceptance criteria:

- User can enter and exit Ethereal layer through spire interactions.
- Camera navigation, selected hex, minimap, and action paths remain correct per layer.
- No base-layer regressions when never using spires.

### R4. Add S2 structure/UI support

- Extend structure types, labels, markers, and detail panels for S2 structures.
- Minimum required S2 structures for frontend: Spire, Camp, Essence Rift, Holy Site, Bitcoin Mine.

Acceptance criteria:

- All S2 structures render with correct icon/name/interaction entry points.
- Unknown structure fallback is not shown for expected S2 entities.

### R5. Add S2 systems UX surfaces

- Faith system surfaces: faith leaderboard, devotion controls, wonder detail panels.
- Village and deployment updates: militia timer state, raid immunity state, army strength/deployment cap UI.
- Agent updates: type badges/metadata, local-message UX with essence cost preview.
- Optional exploration reward UX: subtle tile indicator and collect/bypass behavior in explore flow.

Acceptance criteria:

- Core S2 loops are discoverable and actionable from UI.
- Major timers/caps/costs visible before player commits action.

### R6. Config/admin/deployer updates for S2 worlds

- Add S2 preset in factory/admin world-config builder.
- Add S2 duration and spacing defaults.
- Ensure deployer supports S2 mode config payload shape expected by contracts.

Acceptance criteria:

- Admin can deploy/configure a world as Blitz or S2 from factory UI.
- Config calldata generated by admin matches contract interfaces.

## 5. Implementation Plan and Ownership

## Phase 1: Mode and Lobby Foundation

Owner: Raschel

Deliverables:

- Game mode registry refactor and `s2` mode addition.
- Mode-aware availability query model.
- Mode-aware registration and entry orchestration.
- Factory/admin `s2-season` preset.

Primary files:

- `client/apps/game/src/config/game-modes/index.ts`
- `client/apps/game/src/hooks/use-world-availability.ts`
- `client/apps/game/src/hooks/use-world-registration.ts`
- `client/apps/game/src/ui/features/landing/components/game-entry-modal.tsx`
- `client/apps/game/src/ui/features/admin/services/world-config-builder.ts`
- `client/apps/game/src/ui/features/admin/pages/factory.tsx`
- `config/deployer/config.ts`
- `packages/provider/src/index.ts`

Definition of done:

- User can select and enter both modes with correct flow.
- S2 no longer depends on Blitz selectors/system names.

## Phase 2: New Map Layer and Spire Travel

Owner: Loaf

Deliverables:

- Layer-aware position model and URL parameters.
- Map query/stream + scene layer support.
- Spire travel UX and conflict/occupancy handling.
- Layer-aware minimap and navigation integrity.

Primary files:

- `packages/types/src/types/common.ts`
- `packages/core/src/systems/position.ts`
- `packages/core/src/utils/tile.ts`
- `client/apps/game/src/dojo/queries.ts`
- `client/apps/game/src/three/scenes/worldmap.tsx`
- `client/apps/game/src/three/utils/navigation.ts`
- `client/apps/game/src/three/utils/location-manager.ts`
- `client/apps/game/src/hooks/store/use-three-store.ts`

Definition of done:

- End-to-end traversal between base layer and Ethereal layer works in world map and gameplay actions.

## Phase 3: S2 Systems and Structure Surfaces

Owner: Raschel

Deliverables:

- Structure type extension and UI support for S2 structures.
- Faith UX and leaderboard surfaces.
- Village/deployment strength/timer UI.
- Agent and exploration-reward UI updates.

Primary files:

- `packages/types/src/constants/structures.ts`
- `packages/core/src/utils/structure.ts`
- `client/apps/game/src/ui/features/world/components/bottom-right-panel/hex-minimap.tsx`
- `client/apps/game/src/ui/features/*` (faith, village, military, explore panels)

Definition of done:

- S2 systems are visible and usable without debug-only workflows.

## Phase 4: Visual Direction and Asset Pack

Owner: Ermakow

Deliverables:

- S2 visual language package for Ethereal layer and spire interactions.
- Icon/label/art pass for new structures and S2 overlays.
- Layer transition motion and marker readability pass.

Asset targets:

- `client/public/images/labels/*`
- Minimap/marker icon assets
- Layer background/biome textures and related UI artwork

Definition of done:

- New S2 content is visually coherent and distinguishable from Blitz.
- All new visual assets are production-ready and integrated.

## 6. Cross-Team Task Dispatch

Raschel:

1. Mode architecture and mode resolution refactor.
2. Lobby, registration, and entry flows for S2.
3. Admin/deployer S2 preset and config plumbing.
4. S2 structure and systems UI implementation.
5. Integration QA pass across non-map features.

Loaf:

1. Layered coordinate model (`alt`) across types, state, and URL.
2. Layer-aware map queries and scene rendering.
3. Spire traversal UX and occupancy-conflict interaction.
4. Minimap and navigation updates for dual-layer play.
5. Performance sanity pass for map-layer switching.

Ermakow:

1. Ethereal layer art direction and style guide.
2. Spire, Camp, Essence Rift, Holy Site, Bitcoin Mine visual assets.
3. Minimap marker/icon system for new structures.
4. UI overlays for faith, layer state, and S2 interaction moments.
5. Final readability pass across desktop and mobile breakpoints.

## 7. QA and Validation

Functional checks:

- Blitz and S2 worlds both load, register, and enter correctly.
- S2 layer switch via spires works with consistent camera and selection state.
- Structure names/icons/interactions match expected S2 behavior.
- Faith/deployment/agent/explore UI reflects contract state accurately.

Regression checks:

- Existing Blitz join/settle/claim flows remain working.
- Base map performance is not degraded for non-S2 worlds.

Test scope:

- Unit tests for mode resolver, layer position parsing, and registration flow branching.
- Integration tests for world entry flow (Blitz vs S2).
- Manual scenario checklist for spire traversal and cross-layer conflict cases.

## 8. Risks and Open Decisions

- Final mode-discriminator source in world config must be confirmed against deployed S2 contracts.
- Namespace assumptions (`s1_eternum-*`) must be removed or abstracted for S2 worlds.
- Exact system names/selectors for S2 replacements of Blitz-only calls need to be locked before implementation starts.
- If contracts expose additional layer-specific rules (donkey restrictions, ethereal-only entities), frontend guards
  must mirror them explicitly.

## 9. Release Readiness Criteria

- S2 world can be configured, discovered in lobby, entered, and played through core loops.
- Layer traversal and S2 structures are stable in production-like test worlds.
- All critical S2 UI states have final assets and copy.
- Blitz remains fully functional after S2 rollout.
