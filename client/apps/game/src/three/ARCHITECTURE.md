# Three.js architecture

## Render pipeline
- `game-renderer.ts` bootstraps WebGL + CSS2D renderers, sets camera/controls from `constants/rendering.ts`, wires `EffectComposer`, and owns the animation loop (`animate`).
- `SceneManager` swaps scenes with `TransitionManager` fades; `GameRenderer` updates the active scene each frame and renders HUD last.
- Environment map is loaded once via `PMREMGenerator`; stats/memory monitors are opt-in (`VITE_PUBLIC_ENABLE_MEMORY_MONITORING`).
- HUD is a separate Three.js scene (`HUDScene`) rendered after the game scene with depth clear only.

## Scenes
- Base: `scenes/hexagon-scene.ts` sets fog, lights, ground plane, input handlers, highlight/interactive managers, thunder bolts, day/night cycle, and visibility/frustum managers.
- World: `scenes/worldmap.tsx` adds chunked tile rendering, army/structure/quest/chest managers, selection + minimap, Torii streams, and worker-powered hydration.
- Settlement: `scenes/hexception.tsx` focuses on building/biome rendering, previews, and settlement interactions.
- HUD: `scenes/hud-scene.ts` layers navigator arrows, weather/ambience, rain effect, and overlays controlled by UI store state.

## Managers & systems (selected)
- Input/selection: `InputManager`, `InteractiveHexManager`, `HighlightHexManager`, `SelectedHexManager`, `SelectionPulseManager`, `HoverLabelManager`, `SceneShortcutManager`, `LocationManager`.
- Entities/rendering: `ArmyManager` + `ArmyModel`, `StructureManager`, `ChestManager`, `QuestManager`, `BattleDirectionManager`, `ResourceFXManager`, `FXManager`, `Minimap`, `Navigator`.
- Effects: `ThunderBoltManager`, `DayNightCycleManager`, `WeatherManager`, `AmbienceManager`, `RainEffect`, `Particles`, `Aura`.
- Geometry/material helpers: `InstancedBiome`, `InstancedModel`, `MatrixPool`, `MaterialPool`, `HexGeometryPool`, `InstancedMatrixAttributePool`, `FrustumManager`, `CentralizedVisibilityManager`.
- Data/state helpers: `WorldUpdateListener` (Dojo), `gameWorkerManager` (background hydration), `playerCosmeticsStore`, `PlayerDataStore`.
- Experimental: `chunk-system/*` implements a structured chunk lifecycle (state manager, hydration registry, spatial index) but is not wired into `WorldmapScene` yet (import commented).

## State & data flow
- Zustand stores: `useUIStore` (camera targets, selections, cycle progress, toggles), `useAccountStore` (wallet/player), `useWorldLoading` (loading gates). Managers read/write directly to drive UI and camera behaviour.
- Network/game data: Dojo `SetupResult` (components/contracts), Torii streams (`ToriiStreamManager`), SQL API helpers (`sqlApi`), and worker hydration (`gameWorkerManager`) feed managers like `ArmyManager` and `StructureManager`.
- Cosmetics and assets: `cosmetics/*` resolves templates and attachments; constants under `constants/scene-constants.ts` / `constants/army-constants.ts` map models and resources.

## Boundaries & dependencies
- `HexagonScene` mixes scene setup with UI-store sync and lightning/weather logic; `ArmyManager`/`StructureManager` blend data hydration, rendering, selection, and label updates. Consider thinner adapters around data ingestion vs rendering.
- `GUIManager` is a global shared lil-gui instance; folders are created across managers and scenes.
- `chunk-system` is isolated but currently unused; either integrate or trim to reduce drift.

## Lifecycle notes
- `GameRenderer.destroy` disposes renderer/composer/scenes/controls, unsubscribes listeners, and clears memory monitor DOM.
- `HexagonScene.destroy` disposes managers, lights, biome instances, GUI folders, and clears the scene. Entity managers (`ArmyManager`, `StructureManager`, etc.) expose their own `destroy`/`cleanup` paths.
- Resource pools (`MaterialPool`, `MatrixPool`, geometry pools) centralize reuse to limit allocations.

## Logging/debugging
- Rendering stats via `initStats`; memory monitoring via `MemoryMonitor` with spike alerts and material pool stats.
- Selection of GUI folders for post-processing, lighting, fog, ground mesh, storms, etc. Debug logging is scattered (e.g., chunk refreshes, torii updates); noisy `console.log` is present in several managers.
