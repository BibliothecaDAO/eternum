---
name: threejs-best-practices
description:
  authoritative guide on Three.js performance and best practices (2026). Use when writing, refactoring, or optimizing
  Three.js or React Three Fiber code. Covers WebGPU, memory management, and rendering optimization.
---

# Three.js Best Practices (2026)

## Instructions

When generating or reviewing Three.js code, strictly adhere to these guidelines to ensure performance and modern
standards. Prioritize WebGPU-ready code (r171+) while maintaining WebGL 2 fallbacks.

## 1. WebGPU & Renderer

- **Init:** Always use `await renderer.init()` with `WebGPURenderer`. It enables zero-config WebGPU with auto WebGL 2
  fallback.
- **TSL (Three Shader Language):** Write shaders in TSL (`three/tsl`) instead of GLSL/WGSL. It compiles to both
  backends.
- **Particles:** Move particle systems (>50k) to compute shaders using `instancedArray` and `storage` buffers.
- **Config:** Use `forceWebGL: true` only for debugging/legacy support.

## 2. Performance & Draw Calls

- **Target:** Aim for **<100 draw calls** per frame.
- **Instancing:** Always use `InstancedMesh` for repeated objects.
- **Batching:** Use `BatchedMesh` for different geometries sharing the same material.
- **Materials:** Share material instances across meshes; never create new materials inside loops.
- **Static Geometry:** Merge static meshes using `BufferGeometryUtils.mergeGeometries`.
- **Culling:** Ensure strict frustum culling; manually cull expensive off-screen logic.

## 3. Asset Optimization

- **Models:** Use `Draco` or `Meshopt` compression for geometry.
- **Textures:** Use `KTX2` (UASTC for quality, ETC1S for size) and `basisu` transcoders.
- **Atlas:** Atlas textures to reduce bind overhead.
- **LOD:** Implement Level of Detail (LOD) for complex models.

## 4. Memory Management

- **Disposal:** Manually call `.dispose()` on **geometries, materials, textures, and render targets** when objects are
  removed.
- **Pooling:** Use object pooling for frequently spawned/despawned entities (e.g., bullets).
- **React Three Fiber:** Use `useLoader.preload` and `useGLTF.preload`. Never create objects ( `new THREE.Vector3`)
  inside `useFrame`.

## 5. Lighting & Shadows

- **Limits:** Max ~3 active dynamic lights per scene.
- **Shadows:** Use Baked Lightmaps or Ambient Occlusion where possible.
- **Optimization:** Use Cascaded Shadow Maps (CSM) for large scenes; disable `autoUpdate` for static shadow casters.
- **Environment:** Use Environment Maps (IBL) for cheap, high-quality ambient lighting.

## 6. React Three Fiber (R3F) Specifics

- **Loops:** Mutate refs inside `useFrame`; **never** call `setState` inside the render loop.
- **Demand Rendering:** Use `frameloop="demand"` for static scenes.
- **Components:** Wrap expensive components in `React.memo`.
- **Performance:** Use `r3f-perf` to monitor calls.

## 7. Post-Processing

- **Library:** Use `pmndrs/postprocessing` over the default Three.js `EffectComposer`.
- **Optimization:** Disable multisampling (MSAA) if using heavy post-processing.
- **Bloom:** Use selective bloom; apply tone mapping at the very end of the pipeline.

## 8. Debugging & Workflow

- **Tools:** Use `stats-gl` for WebGPU monitoring and `Spector.js` for profiling.
- **Leaks:** Check `renderer.info.memory` to ensure geometries/textures count drops after scene changes.
