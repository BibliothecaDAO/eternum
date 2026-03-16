# Eternum S2 Cosmetic Pipeline Completion PRD / TDD

Date: 2026-03-16
Status: Proposed
Scope: `client/apps/game/src/three` cosmetics resolution, ownership hydration, selection state, army and structure skin rendering, attachment lifecycle, UI integration, tests, and disposal correctness

## Implementation Tracking

- [x] Phase 0: Baseline Lock and Contract Cleanup
- [x] Phase 1: Ownership Hydration and Registry Mapping
- [x] Phase 2: Selection Source of Truth and UI Integration
- [x] Phase 3: Blitz Registration Wiring
- [ ] Phase 4: Resolver Contract Normalization
- [ ] Phase 5: Renderer Integration and Asset Loading Unification
- [ ] Phase 6: Targeted Runtime Refresh and Disposal
- [ ] Phase 7: Test Net and Signoff

## 1. Objective

Finish the cosmetic system in `client/apps/game/src/three` so that:

1. owned on-chain cosmetic attrs become real runtime cosmetic eligibility,
2. users can assign a Blitz cosmetic loadout in the Cosmetics UI before each game,
3. the selected cosmetic token ids are submitted during Blitz registration and become the active game cosmetics,
4. selected cosmetics become explicit per-army, per-structure, and global attachment state,
5. armies and structures consume the same resolved runtime contract,
6. preloading and runtime rendering stop using contradictory asset-loading paths,
7. cosmetic changes refresh only the affected entities,
8. tests cover the flow from UI assignment and registration to rendered result and teardown.

## 2. Background

The repo already has most of the cosmetic building blocks:

- a seeded cosmetic registry,
- a player cosmetics store,
- a resolver for army and structure cosmetics,
- a shared asset cache for cosmetic payloads,
- an attachment manager with pooling and placeholder upgrades,
- army and structure manager integration points,
- worldmap-level preload for cosmetic assets.

The contract path for pre-game cosmetics also already exists.

`blitz_realm_systems.register` accepts `cosmetic_token_ids: Span<u128>`, locks those collectible ids, and writes their attrs into `BlitzCosmeticAttrsRegister`.
The gap is on the client side: the current registration hook still submits an empty cosmetic list, so the available contract surface is not exposed through the UI flow.

However, the current system is only partially complete.

The live runtime reads `BlitzCosmeticAttrsRegister`, but it does not convert those owned attrs into concrete runtime selections.
As a result, the resolver usually falls back to base/default cosmetics unless tests manually inject a snapshot or a developer uses debug overrides.

At the same time, the runtime has two separate asset-loading stories:

- attachments use the shared cosmetic asset cache,
- skin rendering for armies and structures reloads GLTFs in renderer-local systems.

This means the repo has the shape of a finished cosmetics architecture, but not a coherent end-to-end delivery path.

## 3. Current Architecture

```text
On-chain / Dojo
  BlitzCosmeticAttrsRegister
    -> player-cosmetics-store.ts
       stores owned attrs/tokens only

Registry / Resolution
  registry.ts
    -> all known skins + attachments + assetPaths
  resolver.ts
    -> owner + target + registry fallback
    -> returns cosmeticId + assetPaths + attachments

Preload
  worldmap.tsx
    -> preloadAllCosmeticAssets()
    -> asset-cache.ts warms GLTFs/textures/materials

Army Render Path
  army-manager.ts
    -> resolveArmyCosmetic()
    -> armyModel.assignCosmeticToEntity(entityId, cosmeticId, assetPath[0])
  army-model.ts
    -> loads cosmetic GLTF again
    -> suppresses base model when cosmetic skin is active

Structure Render Path
  structure-manager.ts
    -> resolveStructureCosmetic()
    -> group visible structures by cosmeticId
    -> ensureCosmeticStructureModels(cosmeticId, assetPaths)
    -> render through InstancedModel batches

Attachment Path
  attachment-manager.ts
    -> template id -> registry source
    -> clone pooled Object3D from asset-cache payload
    -> placeholder until asset ready
    -> per-frame mount transform updates
```

## 4. Problem Statement

The cosmetic system has five architectural gaps.

### 4.1 Ownership does not become selection

`player-cosmetics-store.ts` hydrates raw attrs from the Dojo component, but it does not populate:

- `selection.armies`
- `selection.structures`
- `selection.globalAttachments`

That makes live runtime resolution incomplete.

### 4.2 The runtime has two sources of truth

Three-side runtime cosmetics are conceptually sourced from `playerCosmeticsStore`, but the cosmetics UI uses `useCosmeticLoadoutStore`.
Those stores are not wired together, so the showcase flow and the world render flow do not reflect the same state.

### 4.3 There is no pre-game equip flow into Blitz registration

Players can browse and locally select cosmetics in the landing Cosmetics section, but that selection is not connected to the Blitz join path.
`use-world-registration.ts` currently calls `register` with an empty cosmetic payload, which means pre-game cosmetic assignment is not actually part of the registration flow.

### 4.4 Skin rendering and preload use different asset pipelines

`asset-cache.ts` preloads cosmetic assets, but army and structure skin rendering do not consume those cached payloads directly.
This makes preload partially redundant and increases the chance of cache drift or duplicate GLTF work.

### 4.5 The resolved contract is too implicit

Managers currently infer important cosmetic behavior from string suffixes such as `:base` and `:default`, and armies still assume a cosmetic skin only needs `assetPaths[0]`.
That is workable for a prototype but fragile for a shipping pipeline.

## 5. Confirmed Findings

### 5.1 The registry is already the correct identity layer

`registry.ts` is the real `cosmeticId -> assetPaths / attachments / metadata` source and should remain the canonical cosmetic catalog.

### 5.2 The missing bridge is attrs-to-registry eligibility

The system knows what a player owns and it knows what cosmetics exist, but there is no complete runtime bridge between those two facts.

### 5.3 Attachments are structurally ahead of skins

Attachments already have:

- pooled runtime objects,
- placeholder upgrade behavior,
- mount transforms,
- shared asset-cache integration.

The cleanup effort should preserve this subsystem and bring skins up to the same level of coherence.

### 5.4 Armies and structures should share a higher-level contract, not identical renderer internals

It is acceptable for armies and structures to keep separate renderer-specific instancing implementations.
It is not acceptable for them to depend on different runtime cosmetic semantics.

### 5.5 The UI should not be a parallel cosmetics state system

The cosmetics feature UI can keep its own view helpers, but selected cosmetic state needs to be derived from or written through the same runtime store used by three.

### 5.6 Blitz registration already has the right contract seam

The contract does not need a new registration entrypoint for pre-game cosmetic assignment.
The existing Blitz register call already accepts cosmetic token ids and persists their attrs for the match.

Implication:

- pre-game cosmetic assignment is primarily a client integration project,
- post-registration cosmetic changes would be a separate contract/product scope.

## 6. Goals

1. Make cosmetic ownership, eligibility, and selection explicit and typed.
2. Let players configure a pending Blitz cosmetic loadout from the Cosmetics UI before registration.
3. Submit that pending loadout through the existing Blitz registration transaction.
4. Make `playerCosmeticsStore` the runtime source of truth for three-side cosmetic state.
5. Bridge on-chain owned attrs to registry-backed cosmetics eligibility.
6. Normalize resolver output so managers do not infer behavior from string conventions.
7. Make preload meaningful by unifying the cosmetic asset-loading strategy.
8. Ensure army and structure managers refresh only the entities affected by cosmetic state changes.
9. Preserve attachment pooling and mount behavior.
10. Cover UI assignment, registration, hydration, rendering, refresh, and teardown with tests.

## 7. Non-Goals

- Reworking the cosmetic art catalog.
- Replacing the current attachment mount transform system with skeletal bone attachments.
- Redesigning the cosmetics UI.
- Shipping a new marketplace or equip UX in this PRD.
- Supporting cosmetic swaps after a player has already registered for the current Blitz game.
- Replacing army or structure instancing architectures wholesale.
- Adding cosmetic-specific networking beyond what is required to hydrate or persist selection state.

## 8. Product Requirements

### R1. Ownership and selection must be distinct runtime concepts

The runtime cosmetic store must separate:

- owned attrs or owned token data,
- eligible registry-backed cosmetics,
- selected army cosmetics,
- selected structure cosmetics,
- selected global attachments.

Acceptance:

- types make the difference explicit,
- live hydration can update ownership without overwriting active local or remote selection unexpectedly,
- resolvers do not have to interpret raw attrs directly.

### R2. There must be a stable attrs-to-registry mapping layer

The system must translate owned on-chain attrs into registry eligibility.

Required design outcome:

- registry entries expose an ownership key that can be matched against hydrated attrs,
- mapping logic lives in one runtime module,
- tests prove that owned attrs resolve to expected eligible cosmetics.

Acceptance:

- a player owning a known cosmetic attr becomes eligible for the corresponding registry entry,
- unknown attrs are ignored safely and surfaced through diagnostics in development,
- ownership mapping is deterministic.

### R3. Users must be able to assign a Blitz loadout from the Cosmetics UI before each game

The landing Cosmetics section must allow a player to choose which owned cosmetic tokens will be used for their next Blitz registration.

Required UX outcome:

- selection happens in the existing cosmetics section,
- selection is grouped by logical slot or assignment target,
- the UI shows a pending Blitz loadout summary,
- the user can enter Blitz knowing which cosmetics will be applied.

Required data outcome:

- the pending loadout is stored per account and per Blitz world context,
- the pending loadout resolves to concrete cosmetic token ids,
- client-side validation enforces slot exclusivity and `collectibles_cosmetics_max`.

Acceptance:

- the user can assign and unassign owned cosmetics before registration,
- the UI can show when the pending loadout is empty, valid, or exceeds constraints,
- the same loadout is visible from the cosmetics section and the game entry flow.

### R4. Blitz registration must submit the selected cosmetic token ids

The current registration flow must stop sending an empty cosmetic span.

Required outcome:

- `use-world-registration.ts` reads the pending Blitz loadout,
- `register` calldata includes the selected cosmetic token ids,
- the loadout is frozen for that registration transaction,
- after successful registration, the game hydrates cosmetics from `BlitzCosmeticAttrsRegister`.

Acceptance:

- registering for Blitz with a non-empty loadout writes cosmetic attrs for that player,
- registering with no selected cosmetics remains valid and explicit,
- failed registration does not clear the pending loadout,
- successful registration marks the applied loadout as the active game loadout for that world.

### R5. Runtime selection must have one source of truth

`playerCosmeticsStore` must become the runtime store consumed by three managers and any equip UI adapter.

Acceptance:

- the cosmetics UI writes through a dedicated selection API instead of keeping an isolated loadout model,
- army and structure resolvers consume the same underlying selected state,
- debug overrides remain additive and development-only.

### R6. Resolver output must be explicit

The resolver contract must stop using string suffix conventions as a behavioral API.

Required outcome:

- resolvers return a typed skin object and typed attachment list,
- the result explicitly tells consumers whether the selected skin is fallback/default or custom,
- consumers no longer inspect `cosmeticId.endsWith(":base")` or `cosmeticId.endsWith(":default")`.

Acceptance:

- army and structure managers branch on typed flags or explicit fields,
- tests fail if fallback/custom semantics regress.

### R7. Skin asset-loading policy must be unified

The project must choose one policy and implement it end to end.

Chosen direction:

- keep `asset-cache.ts` as the canonical cosmetic asset preload/cache layer,
- add renderer adapters so army and structure skin renderers build instanced render data from cached cosmetic payloads instead of reloading GLTFs independently.

Acceptance:

- preload warms assets that the runtime renderers can actually consume,
- a cosmetic skin GLTF is not fetched twice through parallel codepaths during normal runtime,
- army and structure renderers remain renderer-specific but asset-source-consistent.

### R8. Army and structure selection semantics must match

Armies and structures may keep different rendering internals, but they must share:

- the same ownership model,
- the same selection model,
- the same resolver contract,
- the same fallback/custom semantics.

Acceptance:

- both paths can resolve base/default, equipped custom skin, and attachments from the same conceptual inputs,
- both paths refresh correctly when selection changes.

### R9. Cosmetic changes must refresh targeted entities only

The runtime must support owner-scoped or entity-scoped cosmetic refresh without forcing a full chunk rebuild unless required by visibility batching.

Acceptance:

- changing a player's cosmetic selection updates their visible armies and structures,
- attachment-only changes do not force unnecessary full model reloads,
- invisible entities can lazily pick up the new state when they become visible.

### R10. Teardown and disposal must be deterministic

Cosmetic caches, renderer-owned skin data, and attachment objects must all have clear ownership and deterministic disposal.

Acceptance:

- destroying worldmap disposes runtime cosmetic scene resources safely,
- renderer-owned instanced materials and geometries are released exactly once,
- shared cached assets survive until the owning cache is cleared by policy.

## 9. Technical Design

### 9.1 Data model

Introduce a clearer runtime model under `client/apps/game/src/three/cosmetics/types.ts`.

Preferred structure:

```ts
interface CosmeticOwnershipSnapshot {
  owner: string;
  version: number;
  ownedAttrs: string[];
  eligibleCosmeticIds: string[];
}

interface PlayerCosmeticSelection {
  armies?: Record<string, { skin?: string; attachments?: string[] }>;
  structures?: Record<string, { skin?: string; attachments?: string[] }>;
  globalAttachments?: string[];
}

interface PlayerCosmeticsSnapshot {
  owner: string;
  version: number;
  ownership: CosmeticOwnershipSnapshot;
  selection: PlayerCosmeticSelection;
  pendingBlitzLoadouts?: Record<string, BlitzGameLoadoutDraft>;
  activeBlitzLoadouts?: Record<string, BlitzGameLoadoutApplied>;
}

interface ResolvedCosmeticSkin {
  cosmeticId: string;
  assetPaths: string[];
  isFallback: boolean;
  modelType?: ModelType;
  modelKey?: string;
  registryEntry?: CosmeticRegistryEntry;
}

interface CosmeticResolutionResult {
  skin: ResolvedCosmeticSkin;
  attachments: CosmeticAttachmentTemplate[];
  metadata?: Record<string, unknown>;
}
```

Key changes:

- rename the current `tokens` concept to `ownedAttrs`,
- add `eligibleCosmeticIds`,
- make `skin` explicit in the resolution result,
- track pending and applied Blitz loadouts separately.

### 9.2 Registry mapping

Extend `CosmeticRegistryEntry` with a stable ownership key.

Preferred field:

```ts
ownershipKeys?: string[];
```

For seeded cosmetics backed by raw attrs, the ownership key should be the normalized attr hex string.
This avoids reverse-engineering ownership from asset path names.

Mapping module responsibilities:

- normalize hydrated attrs,
- find matching registry entries by `ownershipKeys`,
- compute eligible cosmetic ids,
- expose diagnostics for unknown attrs in development.

### 9.3 Store responsibilities

`player-cosmetics-store.ts` should own:

- hydration of owned attrs from Dojo,
- pending Blitz loadout draft state,
- applied Blitz loadout state for the active game,
- computation of eligible cosmetic ids,
- application of remote or local selection,
- event subscription for owner-scoped cosmetic changes.

Required API surface:

- `hydrateOwnershipFromBlitzComponent(components, owner)`
- `setPendingBlitzLoadout(worldKey, owner, tokenIds)`
- `getPendingBlitzLoadout(worldKey, owner)`
- `markAppliedBlitzLoadout(worldKey, owner, tokenIds)`
- `applySelection(owner, selection)`
- `getSnapshot(owner)`
- `subscribe(listener)`

Selection writes from UI should flow through `applySelection()`.

The pending Blitz loadout should be keyed by:

- account address,
- chain,
- world name or resolved world key.

### 9.4 UI integration

`useCosmeticLoadoutStore` should stop being the source of selected cosmetics.

Preferred migration:

1. keep the hook temporarily,
2. make it a thin adapter over `playerCosmeticsStore`,
3. extend the landing Cosmetics section to present a "Next Blitz Loadout" summary and assignment controls,
4. surface the same pending loadout summary in the game entry flow before registration,
5. remove standalone storage once the migration is complete.

This avoids a large UI rewrite while still making three runtime state authoritative.

### 9.5 Blitz registration integration

The pre-game equip flow should integrate with the existing registration seam rather than introduce a new contract path.

Current behavior:

- `use-world-registration.ts` builds `register` calldata with an empty cosmetic payload.

Required behavior:

- resolve the pending Blitz loadout before registration,
- validate that every selected token is still owned and eligible,
- serialize those token ids into the `register` call's `cosmetic_token_ids`,
- preserve the pending loadout if registration fails,
- mark the loadout as applied if registration succeeds.

Game entry flow requirements:

- `game-entry-modal.tsx` must show the pending Blitz loadout state before registration,
- the user must be able to jump to the Cosmetics section to edit that loadout,
- after registration, the current game's loadout becomes read-only for that run.

This PRD explicitly scopes pre-game assignment only.
Changing cosmetics after registration is out of scope because the current contract path is registration-time only.

### 9.6 Resolver contract

`resolveArmyCosmetic()` and `resolveStructureCosmetic()` should:

- receive owner + target,
- read ownership and selection from `playerCosmeticsStore`,
- validate selected cosmetics against eligibility and target compatibility,
- fall back to registry defaults only when no valid equipped cosmetic exists,
- return typed `skin` and `attachments`.

Attachment merging rules:

1. start with skin-provided attachments,
2. merge valid global attachments,
3. merge valid target-local attachments,
4. enforce slot uniqueness by explicit slot replacement.

For Blitz mode, resolver inputs should prioritize the applied game loadout derived from registration attrs over any pending draft loadout.

### 9.7 Renderer integration

Armies:

- `army-manager.ts` should branch on `result.skin.isFallback`,
- `ArmyModel.assignCosmeticToEntity()` should accept a typed skin payload or a cosmetic asset handle abstraction rather than a raw `assetPath[0]`,
- `ArmyModel` should build cosmetic instanced model data from cached GLTF payloads.

Structures:

- `structure-manager.ts` should store `ResolvedCosmeticSkin`,
- visible structure batching should group by `skin.cosmeticId`,
- `ensureCosmeticStructureModels()` should build renderer models from the shared cached payload.

This PRD does not require armies and structures to share renderer classes.
It requires them to share asset-source and resolution semantics.

### 9.8 Attachment subsystem

Keep the current `CosmeticAttachmentManager` and `mount-resolver.ts` model.

Cleanup only:

- ensure attachment templates emitted by resolvers are ownership-valid,
- keep template ids unique,
- keep attachment pooling separate from skin rendering,
- continue to support placeholder-to-ready upgrades.

### 9.9 Refresh model

Add owner-scoped refresh support.

Preferred runtime hooks:

- `ArmyManager.refreshCosmeticsForOwner(owner)`
- `StructureManager.refreshCosmeticsForOwner(owner)`

Expected behavior:

- visible entities owned by that address re-resolve cosmetics,
- attachment signatures are recomputed,
- skin assignment changes update instanced render state,
- invisible entities pick up changes on next visibility pass.

Pending draft loadout changes should not mutate an already registered Blitz game's applied cosmetics.
They only affect the next registration attempt.

### 9.10 Disposal and ownership

Ownership boundaries:

- shared asset cache owns cached GLTFs, textures, and pooled materials,
- army and structure renderers own their instanced render data derived from cached assets,
- attachment manager owns pooled scene objects,
- scene teardown clears renderer-owned objects and attachment objects,
- cache clearing remains an explicit policy call, not automatic on every scene destroy.

## 10. Files In Scope

Primary files:

- `client/apps/game/src/three/cosmetics/types.ts`
- `client/apps/game/src/three/cosmetics/registry.ts`
- `client/apps/game/src/three/cosmetics/player-cosmetics-store.ts`
- `client/apps/game/src/three/cosmetics/resolver.ts`
- `client/apps/game/src/three/cosmetics/asset-cache.ts`
- `client/apps/game/src/three/cosmetics/attachment-manager.ts`
- `client/apps/game/src/three/managers/army-manager.ts`
- `client/apps/game/src/three/managers/army-model.ts`
- `client/apps/game/src/three/managers/structure-manager.ts`
- `client/apps/game/src/three/scenes/worldmap.tsx`
- `client/apps/game/src/hooks/use-world-registration.ts`
- `client/apps/game/src/ui/features/cosmetics/model/use-cosmetic-loadout-store.ts`
- `client/apps/game/src/ui/features/cosmetics/cosmetics-view.tsx`
- `client/apps/game/src/ui/features/landing/components/game-entry-modal.tsx`

Supporting tests:

- `client/apps/game/src/three/cosmetics/__tests__/*`
- `client/apps/game/src/three/managers/*cosmetic*`
- `client/apps/game/src/three/managers/army-manager*.test.ts`
- `client/apps/game/src/three/managers/structure-manager*.test.ts`

## 11. TDD Delivery Plan

### Phase 0: Baseline Lock and Contract Cleanup

Scope:

- inventory current runtime behavior,
- rename ambiguous ownership fields,
- define the new typed result and snapshot contracts,
- add failing tests before implementation.

Acceptance:

- the repo has one documented cosmetic runtime contract,
- old string-suffix behavior is covered by baseline tests before removal,
- baseline tests capture that current registration sends an empty cosmetic list.

Tests first:

- add failing tests for current `playerCosmeticsStore` ownership shape,
- add failing tests for pending Blitz loadout draft shape,
- add failing tests for explicit `skin.isFallback`,
- add failing tests for invalid selected cosmetic rejection,
- add failing tests proving base/default fallback still works,
- add failing tests proving registration currently emits no cosmetic ids.

### Phase 1: Ownership Hydration and Registry Mapping

Scope:

- extend registry entries with ownership keys,
- implement attrs-to-registry mapping,
- store `ownedAttrs` and `eligibleCosmeticIds` in snapshots.

Acceptance:

- hydrating `BlitzCosmeticAttrsRegister` yields deterministic eligibility,
- unknown attrs are ignored safely,
- ownership mapping is fully unit tested.

Tests first:

- add failing tests for known attr -> eligible army cosmetic,
- add failing tests for known attr -> eligible attachment,
- add failing tests for unknown attr ignoring,
- add failing tests for duplicate attr normalization.

### Phase 2: Selection Source of Truth and UI Integration

Scope:

- add selection APIs to `playerCosmeticsStore`,
- route UI loadout writes through the runtime store,
- add pre-game Blitz loadout assignment in the Cosmetics section,
- surface the same loadout in the Blitz game entry flow,
- remove isolated selected-state ownership.

Acceptance:

- three managers and cosmetics UI observe the same selected state,
- selection survives ownership hydration refreshes correctly,
- the pending Blitz loadout is visible and editable before registration,
- slot and count validation is enforced in UI state.

Tests first:

- add failing tests for applying army selection,
- add failing tests for applying structure selection,
- add failing tests for global attachments,
- add failing tests proving hydration does not wipe valid selection unexpectedly,
- add failing tests for UI adapter parity,
- add failing tests for pending Blitz loadout editing,
- add failing tests for game-entry modal loadout summary.

### Phase 3: Blitz Registration Wiring

Scope:

- read the pending Blitz loadout in `use-world-registration.ts`,
- serialize selected cosmetic token ids into `register`,
- preserve pending draft state on failure,
- mark successful registration loadout as applied.

Acceptance:

- registration with a pending loadout submits cosmetic token ids,
- registration with no loadout submits an explicit empty span,
- successful registration produces loadout-derived cosmetic attrs for the match,
- failed registration leaves the pending draft intact.

Tests first:

- add failing tests for `buildRegisterCalls()` with cosmetic token ids,
- add failing tests for `buildRegisterCalls()` with empty loadout,
- add failing tests for preserving pending loadout on failed registration,
- add failing tests for marking applied loadout on success.

### Phase 4: Resolver Contract Normalization

Scope:

- migrate resolvers to typed `skin`,
- validate selection against eligibility and target compatibility,
- remove suffix-based semantics from manager call sites.

Acceptance:

- resolvers expose fallback/custom state explicitly,
- managers stop checking string suffixes,
- incompatible cosmetics do not resolve.

Tests first:

- add failing tests for incompatible selected skin rejection,
- add failing tests for target-local attachment filtering,
- add failing tests for attachment slot replacement precedence,
- add failing tests for fallback skin selection metadata.

### Phase 5: Renderer Integration and Asset Loading Unification

Scope:

- make army and structure cosmetic skin loaders consume shared cosmetic asset-cache payloads,
- remove duplicate skin fetch behavior,
- normalize multi-asset handling policy.

Acceptance:

- preload directly benefits runtime skin rendering,
- armies no longer assume `assetPaths[0]` without contract support,
- structures and armies derive renderer data from the same asset source.

Tests first:

- add failing tests for preload followed by army skin assignment without duplicate load,
- add failing tests for preload followed by structure skin assignment without duplicate load,
- add failing tests for multi-asset cosmetic policy,
- add failing tests for cached payload reuse across repeated assignments.

### Phase 6: Targeted Runtime Refresh and Disposal

Scope:

- add owner-scoped cosmetic refresh,
- re-resolve only affected visible entities,
- harden disposal boundaries between cache, renderer-owned models, and attachment objects.

Acceptance:

- changing selection updates only affected owners' visible armies and structures,
- attachment-only changes do not force unrelated skin rebuilds,
- scene destroy leaves no live attachment or renderer-owned cosmetic resources behind.

Tests first:

- add failing tests for `refreshCosmeticsForOwner()` on visible armies,
- add failing tests for `refreshCosmeticsForOwner()` on visible structures,
- add failing tests for attachment-only refresh,
- add failing tests for destroy after cosmetic assignment,
- add failing tests for cache retention vs renderer disposal ownership.

### Phase 7: Test Net and Signoff

Scope:

- add end-to-end tests for the finished pipeline,
- validate worldmap preload, hydration, selection, rendering, refresh, and teardown.

Acceptance:

- the cosmetic pipeline is covered from ownership hydration to rendered output,
- tests cover both armies and structures,
- the repo has a clear signoff matrix for fallback, custom skin, and attachment cases.

Tests first:

- add a runtime harness that can simulate owner hydration and cosmetic selection changes,
- add end-to-end tests for pending loadout -> registration -> hydration,
- add end-to-end tests for army fallback, army custom skin, structure fallback, structure custom skin, and attachments,
- add end-to-end tests for worldmap teardown after active cosmetics.

## 12. Risks and Mitigations

### 12.1 Registry metadata drift

Risk:

- owned attrs and seeded registry entries may not stay aligned.

Mitigation:

- make `ownershipKeys` explicit in registry entries and test them directly.

### 12.2 Asset-cache unification could be invasive

Risk:

- renderer-specific model builders may depend on direct GLTF loader flow.

Mitigation:

- introduce adapter helpers that accept cached GLTF payloads first, then move call sites incrementally.

### 12.3 UI integration could create migration churn

Risk:

- replacing the UI store in one pass could destabilize cosmetics screens.

Mitigation:

- keep the UI hook as a temporary facade over the runtime store.

### 12.4 Pending and applied loadout state could become conflated

Risk:

- a new draft selection could accidentally mutate an already registered game's cosmetics.

Mitigation:

- keep separate `pendingBlitzLoadouts` and `activeBlitzLoadouts`,
- treat registration success as the boundary that moves a draft into the applied game state.

### 12.5 Structure batching refresh cost

Risk:

- owner-scoped refresh could still trigger more visible structure work than desired.

Mitigation:

- accept chunk-level visible rebuilds where required, but keep ownership-triggered refresh entry points narrow and explicit.

## 13. Definition of Done

This PRD is complete when:

1. live owned attrs map to eligible registry cosmetics,
2. users can assign a Blitz loadout from the Cosmetics UI before registration,
3. registration submits selected cosmetic token ids for the next game,
4. selected cosmetics flow through one runtime store,
5. resolvers return explicit typed skin and attachment results,
6. armies and structures consume the same cosmetic semantics,
7. preload and runtime rendering use one cosmetic asset-source policy,
8. cosmetic changes refresh affected visible entities correctly,
9. teardown is deterministic,
10. tests cover the full pipeline.

## 14. Recommended Execution Order

1. Phase 0: Baseline Lock and Contract Cleanup
2. Phase 1: Ownership Hydration and Registry Mapping
3. Phase 2: Selection Source of Truth and UI Integration
4. Phase 3: Blitz Registration Wiring
5. Phase 4: Resolver Contract Normalization
6. Phase 5: Renderer Integration and Asset Loading Unification
7. Phase 6: Targeted Runtime Refresh and Disposal
8. Phase 7: Test Net and Signoff
