# Three.js client

This directory hosts the browser Three.js renderer for the Eternum game client (world map, hex view, HUD).

## Quick start

- Install deps once at repo root: `pnpm install`
- Run the Blitz client: `pnpm --dir client/apps/game dev`
- `GameRenderer` is instantiated by the app shell with the Dojo `SetupResult` and mounts into `#main-canvas`.

## Key entry points

- `game-renderer.ts`: renderer bootstrap, controls, post-processing, and the main animation loop.
- `scene-manager.ts`: switches between scenes with fade transitions.
- `scenes/hexagon-scene.ts`: base class that wires shared lighting, fog, ground plane, input, and visibility managers.
- `scenes/worldmap.tsx` and `scenes/hexception.tsx`: concrete scenes for the map and settlement view.
- `scenes/hud-scene.ts`: overlay scene for HUD elements, navigator, and ambience controls.

## Conventions

- Three.js config lives in `constants/rendering.ts` (camera, controls, post-processing, fog).
- Domain constants live in `constants/scene-constants.ts` and `constants/army-constants.ts`.
- Managers are under `managers/`, utilities under `utils/`, effects under `effects/`.
- Toggle graphics via `GraphicsSettings` in `ui/config.tsx`; low skips post-processing.

See `ARCHITECTURE.md` for a deeper map of scenes, managers, and data flow.
