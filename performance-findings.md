# Three.js Renderer Performance Findings

## Interactive Hex Visibility
- Issue: `updateVisibleHexes` filters the entire `allHexes` set on every camera move (`client/apps/game/src/three/managers/interactive-hex-manager.ts:155`). The scan stays O(number of hexes ever seen), so chunk changes become progressively slower.
- Recommendation: Index hex keys by chunk/column so visible hexes can be derived in O(chunk area); avoid iterating the full global set each frame.

## Interactive Hex Mesh Rebuilds
- Issue: `renderHexes` tears down and recreates the instanced mesh, releasing shared geometry and disposing materials on every update (`interactive-hex-manager.ts:224`). This causes constant GPU buffer churn and GC pressure while panning.
- Recommendation: Keep a persistent instanced mesh; update its matrices/count directly and retain shared geometry/materials between updates.

## Chunk Cache Matrix Cloning
- Issue: `InstancedBiome.getMatricesAndCount` clones the full instance matrix buffer whenever cached chunks are saved (`instanced-biome.tsx:102`). Large chunks clone megabytes per switch and duplicate them when re-applied, leading to memory spikes.
- Recommendation: Return lightweight views (reuse underlying `Float32Array` with reference counting) or store positions in a pooled structure to avoid full matrix clones during cache operations.

## Frame Throttle Misconfiguration
- Issue: The low/medium graphics frame limiter uses `1000 / 120` (≈8 ms) while the comment says "30 FPS" in the animation loop (`game-renderer.ts:688`). The guard never triggers, so low settings run at full refresh.
- Recommendation: Set `frameTime` to the intended FPS (e.g., `1000 / 30`) or expose it as a quality-dependent configuration so throttling engages on lower settings.

## Event Listener Cleanup
- Issue: Resize listeners are attached with `this.onWindowResize.bind(this)` but removed with a different bound reference in `destroy` (`game-renderer.ts:424`, `775`), so they leak across reinitializations; focus/blur listeners also stay registered.
- Recommendation: Store bound handlers (or define them as arrow properties) so add/remove share the same function reference, and unregister document listeners during teardown to prevent duplicated work.
