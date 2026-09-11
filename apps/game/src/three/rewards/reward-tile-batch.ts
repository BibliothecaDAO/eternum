import { BatchedMesh, Matrix4, type Mesh, type Material } from "three";

/** Keep each part's authored geometry and animated transform, sharing one render pipeline. */
export class RewardTileBatch {
  readonly mesh: BatchedMesh;
  private readonly geometryIds: number[];
  private readonly instances = new Map<number, number[]>();
  private readonly composed = new Matrix4();
  private readonly previous = new Matrix4();

  constructor(
    private readonly sources: readonly Mesh[],
    material: Material,
  ) {
    const vertices = sources.reduce((sum, source) => sum + source.geometry.attributes.position.count, 0);
    const indices = sources.reduce((sum, source) => sum + (source.geometry.index?.count ?? 0), 0);
    // Reserve a small visible window so first placement keeps the precompiled pipeline.
    // Grow only when needed, rather than uploading a texture sized for the whole map.
    this.mesh = new BatchedMesh(sources.length * 16, vertices, indices, material);
    this.mesh.name = `Reward parts: ${material.name}`;
    this.mesh.frustumCulled = false;
    this.mesh.perObjectFrustumCulled = false;
    this.mesh.sortObjects = false;
    this.mesh.receiveShadow = true;
    this.geometryIds = sources.map((source) => this.mesh.addGeometry(source.geometry));
  }

  writePose(tile: number, placement: Matrix4): void {
    let instances = this.instances.get(tile);
    if (!instances) {
      const required = (this.instances.size + 1) * this.sources.length;
      if (required > this.mesh.maxInstanceCount) {
        this.mesh.setInstanceCount(Math.max(required, this.mesh.maxInstanceCount * 2));
        // Three replaces the matrix textures on growth; rebuild bindings to those textures.
        this.mesh.material.needsUpdate = true;
      }
      instances = this.geometryIds.map((geometry) => this.mesh.addInstance(geometry));
      this.instances.set(tile, instances);
    }
    this.sources.forEach((source, part) => {
      this.composed.multiplyMatrices(placement, source.matrixWorld);
      this.mesh.getMatrixAt(instances[part], this.previous);
      if (this.composed.elements.some((value, index) => Math.fround(value) !== this.previous.elements[index]))
        this.mesh.setMatrixAt(instances[part], this.composed);
    });
  }

  removeTile(tile: number): void {
    this.instances.get(tile)?.forEach((instance) => this.mesh.deleteInstance(instance));
    this.instances.delete(tile);
  }

  dispose(): void {
    this.mesh.dispose();
    this.instances.clear();
  }
}

export function resolveRewardBatchKey(source: Mesh): string | null {
  if (
    Array.isArray(source.material) ||
    source.material.transparent ||
    source.morphTargetInfluences ||
    "isSkinnedMesh" in source
  )
    return null;
  const attributes = Object.entries(source.geometry.attributes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([name, attribute]) =>
        `${name}:${attribute.itemSize}:${attribute.normalized}:${attribute.array.constructor.name}`,
    );
  return `${source.material.uuid}:${Boolean(source.geometry.index)}:${attributes.join(",")}`;
}
