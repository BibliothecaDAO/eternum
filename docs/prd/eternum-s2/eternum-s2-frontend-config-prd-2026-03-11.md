# Eternum S2 Frontend + Config PRD

Date: 2026-03-11 Status: Contract-aligned draft Branch: `aymericdelab/s2-prd-review` Scope: Frontend and config only
(contracts are source of truth)

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

- Game mode registry currently supports `eternum` and `blitz`: `client/apps/game/src/config/game-modes/index.ts`.
- Mode resolution is intentionally tied to contract world config bool (`blitz_mode_on`).
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

### 3.6 Season pass, settlement picker, and village flow state

- Season realm settlement consumes a season pass token and reads pass metadata from `season_pass_address`.
- Season realm placement is selected via `side/layer/point` inputs (contract computes coordinate), not raw `x,y`.
- Village settlement consumes a village pass token and requires choosing a connected realm + available direction slot.
- Village resource is assigned randomly on `village_systems.create` and can only be revealed from post-tx state.
- There is no in-game "buy village pass" function in game systems; acquisition is external to this contract set.

## 4. Product Requirements (Frontend + Config)

### R1. Align mode architecture to current contract truth

- Keep canonical mode ids as `eternum` and `blitz`.
- Resolve mode from `blitz_mode_on` (`true => blitz`, `false => eternum`).
- Layer S2-specific labels/rules/assets under `eternum` mode config.
- Keep Blitz behavior unchanged.

Acceptance criteria:

- Client detects and renders mode using world-config `blitz_mode_on`.
- No Blitz regressions in labels/assets/rules.

### R2. Make lobby, registration, and entry flow mode-aware

- Replace Blitz-only availability assumptions with contract-aware mode query based on `blitz_mode_on`.
- Split registration pipeline by mode.
- Keep Blitz token/registration flow intact (`obtain_entry_token` + `register`).
- Implement season (`eternum`) entry via `realm_systems.create`.
- Add season preflight UX for contract prerequisites (spires settled, season pass approval/consumption, season timing).

Acceptance criteria:

- Player can join Blitz world through existing flow.
- Player can join S2 world without Blitz-only blockers.
- No Blitz system calls are executed for season (`eternum`) join flow.

### R3. Implement S2 multi-layer map support

- Introduce layer-aware position type (`col,row,alt` or equivalent).
- Add URL/state/navigation support for active layer.
- Update map fetch/query/stream paths to include layer discriminator.
- Add layer-switch interaction around Spires and transition UX.
- Handle cross-layer occupancy conflicts with pre-check and revert UX (`destination tile is occupied`).
- Apply cross-layer battle eligibility rule in UI affordances (same `x,y` across layers + adjacent to spire).

Acceptance criteria:

- User can enter and exit Ethereal layer through spire interactions.
- Camera navigation, selected hex, minimap, and action paths remain correct per layer.
- No base-layer regressions when never using spires.

### R4. Add S2 structure/UI support

- Extend discovery/entity mapping, labels, markers, and detail panels for contract-exposed entities.
- Minimum required surfaces for season support: Spire (tile occupier interaction), Mine (mode-specific label), Holy
  Site, Bitcoin Mine.
- Camp remains Blitz-only in discovery UX.

Acceptance criteria:

- Contract-exposed entities render with correct icon/name/interaction entry points for each mode.
- Unknown structure fallback is not shown for expected S2 entities.

### R5. Add S2 systems UX surfaces

- Faith system surfaces: faith leaderboard, devotion controls, wonder detail panels.
- Village and deployment updates: militia timer state, raid immunity state, army strength/deployment cap UI.
- Agent updates: type/tier badges and metadata from discovered troop data.
- De-scope local-message UX with essence cost preview until messaging contracts exist.
- Optional exploration reward UX: subtle tile indicator and collect/bypass behavior in explore flow.

Acceptance criteria:

- Core S2 loops are discoverable and actionable from UI.
- Major timers/caps/costs visible before player commits action.

### R6. Config/admin/deployer updates for S2 worlds

- Add S2 preset in factory/admin world-config builder.
- Add S2 duration and spacing defaults.
- Keep deployer/provider mode config on `set_game_mode_config(blitz_mode_on: bool)`.

Acceptance criteria:

- Admin can deploy/configure a world as Blitz or S2 from factory UI.
- Config calldata generated by admin matches contract interfaces.

### R7. Implement season pass inventory, settlement picker, and village reveal loop

- Show owned season pass inventory and decode pass metadata (realm identity + resources) for the connected player.
- Build per-pass settle flow that submits `realm_systems.create(owner, realm_id, frontend, {side,layer,point})`.
- Add placement picker UX for `side/layer/point` with contract-aligned bounds checks and tx-error mapping.
- Show village pass inventory and allow village settlement via
  `village_systems.create(village_pass_token_id, realm_id, direction)`.
- Treat village-pass "buy" as external inventory acquisition; in-game flow starts once pass ownership is present.
- Add casino-style village resource reveal animation driven by post-transaction on-chain result.

Acceptance criteria:

- User can see eligible season passes and their decoded realm resource metadata before settling.
- User can settle each selected season pass with explicit placement choice and clear validation feedback.
- User can settle a village next to a chosen realm only on available directions.
- Village reveal animation always resolves to the actual on-chain assigned resource.

## 5. Implementation Plan and Ownership

## Phase 1: Mode and Lobby Foundation

Owner: Raschel

Deliverables:

- Game mode registry refactor for contract-aligned `eternum`/`blitz` mode resolution with S2 presentation config.
- Mode-aware availability query model.
- Mode-aware registration and entry orchestration.
- Season pass inventory and per-pass settlement picker UX.
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
- Season (`eternum`) flow no longer depends on `blitz_*` selectors/system names.
- Season pass ownership and metadata are visible before settlement decisions.

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

- Structure/entity mapping and UI support for season-relevant discoveries and occupiers.
- Faith UX and leaderboard surfaces.
- Village/deployment strength/timer UI.
- Agent metadata and exploration-reward UI updates (messaging UX deferred).
- Village pass settlement flow and post-settlement resource reveal UX.

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
4. Contract-aligned season structure/entity and systems UI implementation.
5. Integration QA pass across non-map features.
6. Season pass inventory + placement picker + village pass settlement/reveal flow.

Loaf:

1. Layered coordinate model (`alt`) across types, state, and URL.
2. Layer-aware map queries and scene rendering.
3. Spire traversal UX and occupancy-conflict interaction.
4. Minimap and navigation updates for dual-layer play.
5. Performance sanity pass for map-layer switching.
6. Settlement/village placement map overlays and validity cues for slot selection.

Ermakow:

1. Ethereal layer art direction and style guide.
2. Spire, Mine (Essence Rift label treatment), Holy Site, Bitcoin Mine, and Blitz-only Camp visual assets.
3. Minimap marker/icon system for new structures.
4. UI overlays for faith, layer state, and S2 interaction moments.
5. Final readability pass across desktop and mobile breakpoints.
6. Season pass card visuals and village reveal animation assets.

## 7. QA and Validation

Functional checks:

- Blitz and S2 worlds both load, register, and enter correctly.
- S2 layer switch via spires works with consistent camera and selection state.
- Structure names/icons/interactions match expected S2 behavior.
- Camp discovery UI remains Blitz-only; Mine naming and rewards are mode-aware.
- Faith/deployment/agent/explore UI reflects contract state accurately.
- Season pass metadata, placement selection, and village reveal UX match on-chain outcomes.

Regression checks:

- Existing Blitz join/settle/claim flows remain working.
- Base map performance is not degraded for non-S2 worlds.

Test scope:

- Unit tests for mode resolver, layer position parsing, and registration flow branching.
- Integration tests for world entry flow (Blitz vs S2).
- Manual scenario checklist for spire traversal and cross-layer conflict cases.

## 8. Risks and Open Decisions

- `blitz_mode_on` is the canonical mode discriminator until contracts add another source.
- Namespace assumptions (`s1_eternum-*`) should be abstracted where possible for multi-world compatibility.
- Season entry prerequisites (spire settlement + season pass handling) must be surfaced before send-tx to avoid opaque
  failures.
- Spire is a tile occupier, not a structure category; UI mapping mistakes here will break layer-travel affordances.
- Local messaging/essence-send UX remains out of scope until message contracts are implemented.
- Village pass acquisition ("buy") is external to game systems and must be integrated from marketplace/inventory
  sources.

## 9. Release Readiness Criteria

- S2 world can be configured, discovered in lobby, entered, and played through core loops.
- Layer traversal and S2 structures are stable in production-like test worlds.
- All critical S2 UI states have final assets and copy.
- Blitz remains fully functional after S2 rollout.
