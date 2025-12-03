# Player Cosmetics Implementation Plan

## Background

- Players own cosmetic assets (army skins, structure skins, model attachments) stored in a recs component.
- Current Three.js rendering code loads base army/structure models via `ArmyModel`, `ArmyManager`, and
  `StructureManager`.
- Players select cosmetics in the launcher; choices must stay fixed for the entire play session (no mid-game swaps).
- We need a scalable way to preload cosmetic assets, resolve the correct variant when entities enter view, and support
  developer debugging without affecting production behavior.

## Goals

- Honour player-selected cosmetics for armies, structures, and add-on effects while keeping performance predictable.
- Preload all cosmetic assets up front so rendering only selects among ready-to-use instances.
- Integrate cosmetics with existing instancing pipelines without duplicating logic.
- Provide a developer-only override surface to preview every cosmetic regardless of ownership.

## High-Level Architecture

### Progress Updates (Phase 2) - COMPLETED

- Resolver now maps registry data for armies/structures and exposes registry metadata to downstream systems.
- Worldmap `ArmyManager` hydrates player cosmetics from recs and stores the resolved cosmetic id with each army
  instance.
- `StructureManager` records resolved structure cosmetics, ready for asset/attachment usage in later phases.
- Registry now models attachment slots/mount points and resolver enforces compatibility while merging per-unit/global
  attachment selections.
- Registry + asset cache unit coverage expanded (`asset-cache`, `resolver` smoke tests).
- Mount resolver (`mount-resolver.ts`) provides humanoid/boat/structure mount point transforms.
- `CosmeticAttachmentManager` integrated into both `ArmyManager` and `StructureManager` with:
  - `spawnAttachments()` called during entity creation
  - Signature-based change detection to avoid redundant spawns
  - `retainOnly()` cleanup during chunk switches
  - Transform updates via `updateAttachmentTransforms()`

### Current State Summary

| Component                  | Status      | Notes                                                    |
| -------------------------- | ----------- | -------------------------------------------------------- |
| `types.ts`                 | ✅ Complete | All interfaces defined                                   |
| `registry.ts`              | ✅ Complete | Auto-seeds base models + sample cosmetics                |
| `player-cosmetics-store.ts`| ✅ Complete | Hydrates from `BlitzCosmeticAttrsRegister`               |
| `asset-cache.ts`           | ✅ Complete | GLTF/texture loading with retry + material pooling       |
| `resolver.ts`              | ✅ Complete | Merges player selections + global attachments            |
| `attachment-manager.ts`    | ✅ Complete | Object pooling + placeholder upgrade flow                |
| `mount-resolver.ts`        | ✅ Complete | Humanoid/boat/structure mount transforms                 |
| `debug-controller.ts`      | ✅ Complete | Global overrides with GUI + console API                  |
| Manager integration        | ✅ Partial  | Attachments spawn; model swapping not wired              |
| Bootstrap preloading       | ✅ Complete | `preloadAllCosmeticAssets` called in `performInitialSetup` |
| GUI controls               | ✅ Complete | "Cosmetics Debug" folder in `GUIManager`                 |
| Console API                | ✅ Complete | `window.CosmeticsDebug` with full API                    |

### 1. Cosmetic Registry (Data-Driven Source of Truth)

- Location: `client/apps/game/src/three/cosmetics/registry.ts`.
- Structure: Typed array/object describing each cosmetic (`id`, `category`, `supportedBaseTypes`, `assetPaths`,
  `materials`, `attachments`, `gfxSettings` guardrail, simple doc comments).
- Acts as the single place to add new cosmetics; managers only consume registry lookups.

### 2. Player Cosmetics Store

- Location: `client/apps/game/src/three/cosmetics/player-cosmetics-store.ts`.
- Responsibilities:
  - Read player cosmetic token ids from Dojo via `components.BlitzCosmeticAttrsRegister` using `getComponentValue` +
    `getEntityIdFromKeys`.
  - Cache results by owner `ContractAddress`, exposing a synchronous `getSnapshot(address)` (returns cached cosmetics or
    `undefined`) and async `prefetch()` for bootstrapping.
  - Emit a ready promise so world bootstrap waits for initial load; ignores any mid-session updates (documented
    behaviour).
  - Surface raw token ids alongside derived selections so downstream resolvers can map ids to cosmetic definitions.

### 3. Cosmetic Asset Cache & Preloader

- Location: `client/apps/game/src/three/cosmetics/asset-cache.ts`.
- On world init, iterate the registry and start GLTF/texture loads (respect graphics settings and optionally stagger to
  avoid blocking).
- Store results keyed by `CosmeticId` with the fully prepared Three.js objects (cloned `Scene`, shared `MaterialPool`
  references, attachment templates).
- Provide `getArmyAsset(cosmeticId, fallbackKey)`/`getStructureAsset(...)` helpers that return cached assets or fall
  back to base assets if load failed.
- Log once per missing asset and schedule background retries.

### 4. Cosmetic Resolver

- Location: `client/apps/game/src/three/cosmetics/resolver.ts`.
- API: `resolveArmyCosmetic(ownerAddress, troopType, tier)` and
  `resolveStructureCosmetic(ownerAddress, structureType, stage)`.
- Uses the player store + registry to choose the correct cosmetic id, applies debug overrides (see below), and finally
  returns:
  - `modelKey`: base model or cosmetic variant id used by managers.
  - `attachments`: array of attachment configs for the entity.
  - `metadata`: optional info (e.g., FX intensity) used downstream.
- Ensures defaults when owner has no cosmetics.

### 5. Cosmetic Attachment Manager

- Location: `client/apps/game/src/three/cosmetics/attachment-manager.ts`.
- Manages pooled attachment objects (auras, banners, sprites) that augment base models.
- Integrates with `FXManager`/`Aura` patterns: register attachment templates from the cache, spawn per-entity
  attachments during entity creation, update transforms using existing movement updates, remove on entity despawn.

### 6. Debug Controller (Developer Only)

- Location: `client/apps/game/src/three/cosmetics/debug-controller.ts`.
- Instantiated when `import.meta.env.DEV`.
- Hooks into `GUIManager` to expose:
  - Toggle between respecting player cosmetics and applying overrides.
  - Dropdowns for army/structure cosmetic ids (populated from registry).
  - "Cycle all" action to iterate through cosmetics on successive spawns.
- Provides a global helper (`window.CosmeticsDebug`) for per-entity overrides in console.
- `resolver` checks controller first; in production the controller simply passes through.

## Manager Integration

### Army Flow (`ArmyManager`/`ArmyModel`)

1. On army creation, call `resolveArmyCosmetic` with owner address, troop type, and tier.
2. Use the returned `modelKey` to fetch the instanced model from `CosmeticAssetCache`. Extend internal maps to include
   `ModelKey` so multiple skins can coexist.
3. Instantiate attachments through `CosmeticAttachmentManager`, storing the handles alongside existing entity state.
4. Since cosmetics do not change mid-session, skip re-instancing logic—only run during initial spawn.

### Structure Flow (`StructureManager`)

1. When loading structures within a chunk, call `resolveStructureCosmetic` with owner address and structure type/stage.
2. Cache instanced models per `StructureType + CosmeticId` to keep chunk updates efficient.
3. Spawn attachments (e.g., wonder auras) once and clean up when structures unload.
4. Maintain fallback to base model if cosmetic asset missing.

### World Bootstrap (`WorldmapScene`/`GameRenderer`)

- During `setup`, await `PlayerCosmeticsStore.prefetch()` and `CosmeticAssetCache.preloadAll()` (optionally parallelized
  with existing model loads).
- Provide GUI toggle to skip preloading on low graphics settings.

## Implementation Steps

1. **Scaffold Cosmetics Module**
   - Create `cosmetics/` folder with index exporting registry, store, resolver, cache, debug controller, attachment
     manager.
   - Draft initial TypeScript interfaces and JSDoc comments (registry schema, resolver result types).

2. **Build Registry & Asset Cache**
   - Seed registry with current base models + sample cosmetics.
   - Implement preloader using existing `gltfLoader` and `TextureLoader`; hook into `MaterialPool` for reuse.
   - Add error handling and fallback logging.

3. **Implement Player Cosmetics Store**
   - Connect to recs component fetch in world bootstrap (mock data until backend ready).
   - Ensure immutability during session; add unit test verifying snapshot stability.

4. **Resolver & Debug Controller**
   - Implement resolver that combines store data, registry constraints, and debug overrides.
   - Build GUI controls and console helper; document usage in the plan.

5. **Attachment Manager**
   - Create pooling utilities for attachments (reuse aura sprite, integrate with `FXManager`).
   - Ensure update hooks receive movement deltas (subscribe to `ArmyManager.update` etc.).

6. **ArmyManager Integration**
   - Replace direct `MODEL_TYPE_TO_FILE` lookups with resolver outputs.
   - Extend `ArmyModel` to manage `ModelKey` caches; handle fallback gracefully.
   - Invoke attachment manager and store handles for cleanup.

7. **StructureManager Integration**
   - Similar resolver wiring; manage per-cosmetic instanced models and attachments.
   - Update chunk caching to include cosmetic id in keys.

8. **Bootstrap & Preloading Controls**
   - Add initialization sequence in `WorldmapScene`/`GameRenderer`.
   - Extend `GUIManager` with toggle for cosmetics preload and debug overrides.

9. **Testing & Validation**
   - Unit tests for resolver, registry validation, debug override prioritization.
   - Manual scenarios: low graphics mode, missing asset fallback, dev override cycling.
   - Performance check: measure memory footprint before/after preloading (tie into existing `MemoryMonitor`).

## Debugging & Developer Experience

- GUI: `Cosmetics Debug` folder with override toggles and selectors.
- Console API: `window.CosmeticsDebug.applyArmy(entityId, cosmeticId)` and `clearOverrides()`.
- Document registry editing steps and naming conventions at the top of `registry.ts` or a companion README.

## Open Points / Follow-Ups

- Confirm recs component schema (payload shape, versioning) with backend team.
- Decide on asset naming convention and GLTF optimization budget.
- Align on whether low-end graphics settings should skip certain high-cost cosmetics during preload.
- Add CI check (optional) to validate registry ids against asset files.

---

This plan keeps cosmetics data-driven, preloads assets once per session, integrates cleanly with existing managers, and
equips developers with powerful debug tooling without affecting live gameplay.
