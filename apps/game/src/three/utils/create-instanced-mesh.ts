import { DynamicDrawUsage, InstancedMesh, Mesh, type BufferGeometry, type Material } from "three";
import { StorageInstancedBufferAttribute } from "three/webgpu";

/**
 * Keep native WebGPU transforms out of per-draw uniform uploads.
 * Ordinary instance matrices below the uniform limit are uploaded at full
 * capacity on every draw. Storage attributes upload only when needsUpdate is
 * set and honor dirty ranges. WebGL keeps its native instance attributes:
 * three's storage-matrix fallback does not render correctly on that backend.
 */
export function createInstancedMesh<G extends BufferGeometry, M extends Material | Material[]>(
  geometry: G,
  material: M,
  capacity: number,
): InstancedMesh<G, M> {
  const mesh = new InstancedMesh(geometry, material, capacity);
  // Three's instanced constructor skips these weights, but its node morph path
  // requires them when compiling an empty pool or drawing a single instance.
  Mesh.prototype.updateMorphTargets.call(mesh);
  initializeHiddenInstances(mesh);
  const beforeRender = mesh.onBeforeRender;
  // onBeforeRender runs before shader compilation too. Resolve the actual
  // renderer here so labs, fallback startup and gameplay use the same policy.
  mesh.onBeforeRender = function (renderer, ...args) {
    const backend = (renderer as unknown as { backend?: { isWebGPUBackend?: boolean } }).backend;
    if (backend?.isWebGPUBackend) {
      const matrices = new StorageInstancedBufferAttribute(mesh.instanceMatrix.array, 16);
      matrices.name = mesh.instanceMatrix.name;
      mesh.instanceMatrix = matrices;
    } else {
      // The WebGL matrix wrapper synchronizes its version after attribute
      // uploads. Dynamic usage makes a changed transform visible this frame.
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    }
    mesh.onBeforeRender = beforeRender;
    beforeRender.call(this, renderer, ...args);
  };
  return mesh;
}

/** Bind followers to the source's final backend attribute before either mesh first draws. */
export function createInstancedMeshWithSharedMatrices<G extends BufferGeometry, M extends Material | Material[]>(
  geometry: G,
  material: M,
  source: InstancedMesh,
): InstancedMesh<G, M> {
  const mesh = new InstancedMesh(geometry, material, source.instanceMatrix.count);
  mesh.instanceMatrix = source.instanceMatrix;
  mesh.count = source.count;
  const beforeRender = mesh.onBeforeRender;
  mesh.onBeforeRender = function (renderer, ...args) {
    // The source may replace its attribute for native WebGPU on its first preparation.
    // Prepare it first even if this follower is compiled or rendered ahead of it.
    source.onBeforeRender.call(source, renderer, ...args);
    mesh.instanceMatrix = source.instanceMatrix;
    mesh.onBeforeRender = beforeRender;
    beforeRender.call(this, renderer, ...args);
  };
  return mesh;
}

function initializeHiddenInstances(mesh: InstancedMesh): void {
  // Sparse pools draw through their highest occupied slot. Three initializes
  // unused slots to identity, which would draw phantom models at world origin.
  const matrices = mesh.instanceMatrix.array;
  matrices.fill(0);
  for (let slot = 0; slot < mesh.instanceMatrix.count; slot++) {
    matrices[slot * 16 + 15] = 1;
  }
}
