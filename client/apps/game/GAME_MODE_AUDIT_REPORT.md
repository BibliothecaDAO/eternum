# Game Mode & Configuration Audit Report

Scope: `client/apps/game` (focus on mode-specific branching, hardcoded values, feature flags, and chain/environment assumptions).

## High-Level Findings
- Mode logic is embedded across UI, audio, and 3D layers via `getIsBlitz()` checks, making new modes invasive.
- Game rules (eligibility, labels, resource management) are enforced in components/hooks instead of a central rules layer.
- Chain/environment branching is repeated across providers, runtime profile building, UI, and config with duplicated URLs/IDs.
- Feature flags and performance tuning use scattered booleans and magic numbers without a single source of truth.
- Asset paths and copy are hardcoded in components, limiting reuse and making mode-specific theming brittle.

## Repeated Patterns & Anti-Patterns
- `if (getIsBlitz())` / `isBlitz ? ... : ...` inside components and hooks.
- Inline `switch` or `if` on `env.VITE_PUBLIC_CHAIN` (mainnet/slot/sepolia/local).
- Hardcoded URLs, chain IDs, and addresses spread across runtime and admin configs.
- Inline string literals for labels, CTA copy, and asset paths.
- Hardcoded thresholds (network, polling, quality degradation) without explicit ownership.

## Recommended Architectural Changes
- Introduce `GameModeConfig` registry (`src/domain/game-modes`) with `labels`, `rules`, `assets`, `audio`, `onboarding` strategy.
- Add `useGameModeConfig()` and replace direct `getIsBlitz()` usage in UI/three/audio.
- Centralize chain config in `src/runtime/chain-config.ts` (chain IDs, default RPC/torii, explorers, thresholds).
- Create `featureFlags` module (env-driven with defaults) for rendering and behavior toggles.
- Move game rules (resource/building eligibility, naming) into mode rules and keep UI declarative.
- Add a config completeness test: every mode/chain must define required keys.

## Concrete Refactor Examples

### 1) Onboarding flow branches on mode and chain
- Location: `src/ui/layouts/onboarding/use-onboarding-state.tsx` (`useOnboardingState`), `src/ui/layouts/onboarding/onboarding.tsx` (`Onboarding`).
- Problem: UI owns mode and chain logic, so onboarding changes require component edits.
- Refactor Recommendation: Move decision logic into `GameModeConfig.onboarding` strategy and render via config.
- Before / After Example:
```tsx
// Before (use-onboarding-state.tsx)
const isBlitz = getIsBlitz();
const isLocalChain = env.VITE_PUBLIC_CHAIN === "local";

if (isBlitz) return undefined;
if (isLocalChain) return <LocalStepOne />;
return <SeasonPassButton onSettleRealm={handleEnterSettleRealm} />;
```
```tsx
// After
const { onboarding } = useGameModeConfig();
return onboarding.getBottomContent({ stage, isLocalChain, onEnterSettle: handleEnterSettleRealm });
```
- Scalability Impact: new onboarding flows are added per mode without touching components.

### 2) Construction gating and mobile blocking via env flag
- Location: `src/app.tsx` (`App` component).
- Problem: `env.VITE_PUBLIC_CONSTRUCTION_FLAG` and `IS_MOBILE` directly gate app behavior in the root component.
- Refactor Recommendation: Move app-level gates to a `GameModeConfig.features` or `appPolicy` map.
- Before / After Example:
```tsx
// Before
const isConstructionMode = env.VITE_PUBLIC_CONSTRUCTION_FLAG == true;
const isMobileBlocked = !isConstructionMode && IS_MOBILE;
```
```tsx
// After
const { appPolicy } = useGameModeConfig();
const { isConstructionMode, isMobileBlocked } = appPolicy.resolve({ isMobile: IS_MOBILE, env });
```
- Scalability Impact: feature gates become configurable per mode without changing app root.

### 3) Building/resource eligibility rules enforced in UI
- Location: `src/ui/features/settlement/construction/select-preview-building.tsx` (`SelectPreviewBuildingMenu`),
  `src/ui/features/economy/resources/entity-resource-table/utils.ts` (`BLITZ_UNMANAGEABLE_RESOURCES`),
  `src/ui/features/economy/resources/entity-resource-table/entity-resource-table-new.tsx` (resource management check).
- Problem: Game rules live in components and scattered constants.
- Refactor Recommendation: Move rules to `GameModeConfig.rules` and query via `rules.isBuildingAllowed` / `rules.canManageResource`.
- Before / After Example:
```tsx
// Before
const buildingTypes = Object.keys(BuildingType).filter(
  (key) => isNaN(Number(key)) && (isBlitz ? key !== "ResourceFish" : true),
);

const hasProductionBuilding = actualBuildingCount > 0 &&
  (!isBlitz || !BLITZ_UNMANAGEABLE_RESOURCES.includes(resourceId));
```
```tsx
// After
const { rules } = useGameModeConfig();
const buildingTypes = Object.keys(BuildingType).filter((key) => rules.isBuildingTypeAllowed(key));
const hasProductionBuilding = actualBuildingCount > 0 && rules.canManageResource(resourceId);
```
- Scalability Impact: adding a new mode becomes a config-only change for rules.

### 4) Mode-specific labels embedded in UI
- Location: `src/ui/features/settlement/production/production-sidebar.tsx` (tab labels).
- Problem: UI knows mode-specific naming ("Camps" vs "Villages").
- Refactor Recommendation: Use `modeConfig.labels` to supply view labels.
- Before / After Example:
```tsx
// Before
const activeLabel = activeTab === "realm" ? "Realms" : isBlitz ? "Camps" : "Villages";
```
```tsx
// After
const { labels } = useGameModeConfig();
const activeLabel = activeTab === "realm" ? labels.realms : labels.villages;
```
- Scalability Impact: naming changes become centralized, not duplicated.

### 5) Mode-specific asset paths in 3D model configuration
- Location: `src/three/constants/scene-constants.ts` (`buildingModelPaths`).
- Problem: 3D asset mapping is tied to `isBlitz` at call sites.
- Refactor Recommendation: Move assets to `GameModeConfig.assets` and remove `isBlitz` from render helpers.
- Before / After Example:
```ts
// Before
[BuildingType.ResourceAncientFragment]: isBlitz
  ? BUILDINGS_MODELS_PATH + BuildingFilenames.EssenceRift
  : BUILDINGS_MODELS_PATH + BuildingFilenames.FragmentMine,
```
```ts
// After
const { assets } = getGameModeConfig();
[BuildingType.ResourceAncientFragment]: assets.buildings.ancientFragment,
```
- Scalability Impact: new modes can ship custom assets without modifying renderer logic.

### 6) Minimap icon selection branches on mode
- Location: `src/ui/features/world/components/bottom-right-panel/hex-minimap.tsx` (tile marker icon selection).
- Problem: UI logic contains mode-specific icon selection.
- Refactor Recommendation: Delegate icon lookup to `modeConfig.assets.minimap`.
- Before / After Example:
```tsx
// Before
case StructureType.FragmentMine:
  return { iconSrc: isBlitz ? LABEL_ICONS.essenceRift : LABEL_ICONS.fragmentMine };
```
```tsx
// After
case StructureType.FragmentMine:
  return { iconSrc: assets.minimap.fragmentMine };
```
- Scalability Impact: new modes add icons in config without touching map logic.

### 7) Audio routing and UI labels depend on mode
- Location: `src/audio/config/route-tracks.ts` (`matchRoutePlaylist`), `src/audio/components/MusicPlayer.tsx` (`ScrollingTrackName`).
- Problem: playlist selection and UI copy are mode-specific in component logic.
- Refactor Recommendation: Provide `audio.routeTracks` and `audio.trackLabelSuffix` via mode config.
- Before / After Example:
```ts
// Before
match: (context) => context.isBlitz && createStartsWithMatcher("/play")(context),
```
```ts
// After
match: (context) => createStartsWithMatcher("/play")(context) && audio.modeKey === context.mode,
```
- Scalability Impact: adding mode-specific audio uses config not branching.

### 8) Automation hook uses mode to derive names
- Location: `src/hooks/use-automation.tsx` (realm name syncing).
- Problem: hook embeds mode-based naming, mixing UI rules into automation logic.
- Refactor Recommendation: move name resolution to a mode-aware domain adapter.
- Before / After Example:
```tsx
// Before
const blitzMode = getIsBlitz();
const name = getStructureName(structure.structure, blitzMode).name;
```
```tsx
// After
const { rules } = useGameModeConfig();
const name = rules.getStructureDisplayName(structure.structure);
```
- Scalability Impact: automation remains mode-agnostic; new modes plug into rules.

### 9) Chain/environment branching duplicated in providers and runtime
- Location: `src/hooks/context/starknet-provider.tsx`, `src/runtime/world/profile-builder.ts`,
  `src/hooks/context/signing-policy.ts`, `src/ui/layouts/onboarding/constants.ts`.
- Problem: chain IDs, RPC URLs, and environment assumptions are duplicated.
- Refactor Recommendation: centralize in `chainConfig` and consume everywhere.
- Before / After Example:
```ts
// Before (starknet-provider.tsx)
const isSlot = env.VITE_PUBLIC_CHAIN === "slot";
const fallbackChain = isSlot ? { kind: "slot", chainId: SLOT_CHAIN_ID } : ...
```
```ts
// After
const chainConfig = getChainConfig(env.VITE_PUBLIC_CHAIN);
const resolvedChainId = chainConfig.chainId;
```
- Scalability Impact: new chains or URL changes become single edits.

### 10) Hardcoded endpoints and IDs for market/admin flows
- Location: `src/pm/prediction-market-config.ts`, `src/ui/features/admin/constants.ts`, `src/runtime/world/profile-builder.ts`.
- Problem: URLs and addresses are fixed in code with only partial env overrides.
- Refactor Recommendation: define per-chain endpoints in `chainConfig` (or `marketConfig`) and inject.
- Before / After Example:
```ts
// Before
const SLOT_CONFIG = { toriiUrl: "https://api.cartridge.gg/x/blitz-slot-pm-1/torii", ... };
```
```ts
// After
const config = getPredictionMarketConfig(getChainConfig(env.VITE_PUBLIC_CHAIN));
```
- Scalability Impact: mode/chain-specific endpoints are declarative and consistent.

### 11) Feature flags embedded as inline booleans
- Location: `src/three/managers/interactive-hex-manager.ts` (`useRimLighting`),
  `src/three/utils/quality-controller.ts` (`DEGRADATION_STEPS`).
- Problem: toggles and thresholds are hardcoded, not configurable.
- Refactor Recommendation: create `featureFlags` + `qualityConfig` in config layer.
- Before / After Example:
```ts
// Before
private useRimLighting: boolean = true; // New feature flag
```
```ts
// After
private useRimLighting: boolean = featureFlags.rimLighting;
```
- Scalability Impact: feature rollout and tuning can be done without code changes.

### 12) Magic numbers in network thresholds and polling
- Location: `src/hooks/store/use-network-status-store.ts` (`NETWORK_THRESHOLDS`), `src/config/polling.ts` (`POLLING_INTERVALS`).
- Problem: hardcoded timing values are scattered and not owned by config.
- Refactor Recommendation: move to `networkConfig` and `pollingConfig` with mode/chain overrides.
- Before / After Example:
```ts
// Before
mainnet: { waiting: 15_000, delayed: 30_000, desync: 45_000 },
```
```ts
// After
const thresholds = chainConfig.networkThresholds;
```
- Scalability Impact: allows tuning per chain/mode without touching logic.

### 13) Inline asset path mapping for structure backgrounds
- Location: `src/ui/features/world/components/entities/hooks/use-structure-entity-detail.ts` (`backgroundImage`).
- Problem: asset paths and level logic are hardcoded in a hook.
- Refactor Recommendation: move to `modeConfig.assets.structureBackgrounds` with a helper.
- Before / After Example:
```ts
// Before
if (level >= 3) return "/images/buildings/construction/castleThree.png";
```
```ts
// After
return assets.structureBackgrounds.resolveRealm(level);
```
- Scalability Impact: new art packages or mode reskins don’t require hook edits.

## Next-Step Cleanup Checklist
- Create `GameModeConfig` + `useGameModeConfig()` and migrate `getIsBlitz()` usages incrementally.
- Move rule sets (`canManageResource`, `isBuildingTypeAllowed`, naming) into `modeConfig.rules`.
- Centralize chain config in `src/runtime/chain-config.ts` and refactor provider/profile/admin configs.
- Create a shared asset catalog (`assets.minimap`, `assets.buildings`, `assets.labels`).
- Replace hardcoded thresholds with `networkConfig` + `pollingConfig` and add per-chain overrides.
- Add a config completeness test for modes and chains.

## Appendices

### Appendix A: `getIsBlitz()` Call Sites (mode branching)
```
src/ui/features/economy/resources/resource-chip.tsx:213
src/ui/features/economy/resources/resource-arrival.tsx:16
src/ui/features/economy/resources/entity-resource-table/entity-resource-table-new.tsx:167
src/ui/features/economy/resources/entity-resource-table/entity-resource-table-new.tsx:274
src/ui/features/economy/resources/entity-resource-table/entity-resource-table-new.tsx:281
src/ui/features/economy/resources/entity-resource-table/entity-resource-table-old.tsx:148
src/ui/features/economy/resources/realm-transfer.tsx:69
src/ui/features/economy/resources/realm-transfer.tsx:413
src/ui/features/economy/resources/realm-transfer.tsx:616
src/ui/features/economy/resources/realm-transfer.tsx:633
src/ui/features/economy/resources/realm-transfer.tsx:650
src/ui/features/economy/resources/realm-transfer.tsx:682
src/ui/features/economy/transfers/transfer-automation-panel.tsx:69
src/ui/features/economy/transfers/transfer-automation-panel.tsx:109
src/ui/features/economy/transfers/transfer-automation-popup.tsx:70
src/ui/features/economy/banking/liquidity-table.tsx:26
src/ui/features/economy/banking/swap.tsx:171
src/ui/features/economy/trading/realm-production.tsx:78
src/ui/features/economy/trading/market-resource-sidebar.tsx:27
src/ui/features/economy/trading/market-modal.tsx:178
src/ui/features/economy/trading/select-resources.tsx:41
src/ui/features/settlement/production/production-sidebar.tsx:195
src/ui/features/settlement/production/production-sidebar.tsx:297
src/ui/features/settlement/production/production-body.tsx:83
src/ui/features/settlement/production/production-modal.tsx:107
src/ui/features/settlement/production/realm-info.tsx:27
src/ui/features/settlement/construction/select-preview-building.tsx:427
src/ui/features/prize/prize-panel.tsx:141
src/ui/features/relics/components/relic-activation-selector.tsx:179
src/ui/features/relics/relic-inventory.tsx:59
src/ui/features/world/components/hyperstructures/eternum-hyperstructures-menu.tsx:75
src/ui/features/world/components/hyperstructures/blitz-hyperstructure-shareholder.tsx:27
src/ui/features/world/components/bottom-right-panel/hex-minimap.tsx:205
src/ui/features/world/components/entities/hooks/use-structure-entity-detail.ts:49
src/ui/features/world/components/entities/hooks/use-army-entity-detail.ts:122
src/ui/features/world/components/entities/compact-entity-inventory.tsx:70
src/ui/features/world/containers/left-command-sidebar.tsx:1091
src/ui/features/world/containers/mini-map-navigation/mini-map-navigation.tsx:50
src/ui/features/world/containers/top-header/structure-select-panel.tsx:160
src/ui/features/world/containers/top-header/top-header.tsx:54
src/ui/features/world/containers/top-header/tick-progress.tsx:27
src/ui/features/military/battle/attack-container.tsx:38
src/ui/features/military/components/unified-army-creation-modal/structure-selection-list.tsx:35
src/ui/features/military/components/unified-army-creation-modal/structure-selection-list.tsx:171
src/ui/features/military/components/unified-army-creation-modal/unified-army-creation-modal.tsx:88
src/ui/features/military/components/entities-army-table.tsx:103
src/ui/features/military/components/transfer-resources-container.tsx:114
src/ui/features/military/components/transfer-resources-container.tsx:582
src/ui/features/military/components/transfer-resources-container.tsx:587
src/ui/features/social/components/player-id.tsx:118
src/ui/features/social/components/social.tsx:62
src/ui/features/social/player/player-list.tsx:72
src/ui/features/social/player/players-panel.tsx:106
src/ui/features/social/player/players-panel.tsx:295
src/ui/features/progression/quests/quest-realm-component.tsx:88
src/ui/features/infrastructure/bridge/bridge.tsx:325
src/ui/shared/components/endgame-modal.tsx:125
src/ui/layouts/onboarding-blank-overlay.tsx:11
src/ui/layouts/unified-onboarding/account-panel.tsx:25
src/ui/layouts/onboarding/use-onboarding-state.tsx:34
src/ui/store-managers.tsx:461
src/ui/modules/entity-details/building-entity-details.tsx:62
src/ui/modules/entity-details/realm/realm-details.tsx:81
src/ui/design-system/molecules/select-resource.tsx:53
src/three/scenes/hexception.tsx:171
src/three/managers/structure-manager.ts:266
src/three/managers/minimap.ts:157
src/three/managers/building-preview.tsx:22
src/three/managers/player-data-store.ts:65
src/three/utils/labels/label-factory.ts:482
src/three/utils/labels/label-factory.ts:656
src/audio/config/route-tracks.ts:104
src/audio/components/MusicPlayer.tsx:18
src/hooks/use-automation.tsx:157
```

### Appendix B: `VITE_PUBLIC_CHAIN` References (chain branching)
```
src/pm/prediction-market-config.ts:39
src/pm/prediction-market-config.ts:43
src/init/bootstrap.tsx:57
src/ui/features/landing/sections/markets/details/market-resolution.tsx:124
src/ui/features/landing/sections/markets/details/market-resolution.tsx:300
src/ui/features/landing/sections/markets/use-market-watch.ts:94
src/ui/features/landing/sections/markets/use-market-watch.ts:200
src/ui/features/landing/sections/markets/use-market-servers.ts:110
src/ui/features/landing/sections/create-market.tsx:281
src/ui/features/settlement/components/mint-village-pass-modal.tsx:383
src/ui/features/admin/pages/factory.tsx:270
src/ui/features/progression/onboarding/blitz/hooks/useSettlement.ts:80
src/ui/features/progression/onboarding/blitz/hooks/useEntryTokens.ts:174
src/ui/features/progression/onboarding/blitz/BlitzOnboarding.tsx:122
src/ui/features/progression/onboarding/blitz/factory/FactoryGamesList.tsx:36
src/ui/features/progression/onboarding/blitz/factory/FactoryGamesList.tsx:147
src/ui/features/world-selector/world-selector-modal.tsx:118
src/ui/features/infrastructure/bridge/bridge.tsx:650
src/ui/shared/components/provider-heartbeat-watcher.tsx:19
src/ui/layouts/unified-onboarding/world-select-panel.tsx:29
src/ui/layouts/onboarding/use-onboarding-state.tsx:35
src/ui/layouts/onboarding/constants.ts:4
src/ui/modules/settings/settings.tsx:229
src/tracing/tracer.ts:28
src/tracing/index.ts:29
src/utils/addresses.ts:5
src/utils/addresses.ts:10
src/utils/addresses.ts:14
src/utils/addresses.ts:18
src/utils/addresses.ts:19
src/utils/addresses.ts:21
src/utils/addresses.ts:29
src/utils/config.ts:6
src/posthog.ts:16
src/posthog.ts:30
src/hooks/context/signing-policy.ts:26
src/hooks/context/starknet-provider.tsx:26
src/hooks/context/starknet-provider.tsx:34
src/hooks/context/starknet-provider.tsx:35
src/hooks/context/starknet-provider.tsx:82
src/hooks/helpers/use-game-selector.ts:34
```
