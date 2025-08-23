import * as THREE from "three";

type Hex = { col: number; row: number };

interface ActivePath {
  group: THREE.Group;
  mesh: THREE.Mesh | null;
  positions: THREE.Vector3[];
  hexes: Hex[];
}

export class PathVisualizer {
  private scene: THREE.Scene;
  private previewGroup: THREE.Group;
  private previewMesh: THREE.Mesh | null = null;
  private previewIndexCount = 0;
  private previewPoints: THREE.Vector3[] = [];
  private previewProgress = 0; // 0..1
  private previewSpeed = 4; // segments per second
  private pendingPreviewRebuild = false;
  private lastPreviewRebuild = 0;
  private rebuildIntervalMs = 60; // throttle mesh rebuilds

  private activePaths: Map<number, ActivePath & { indexCount: number }> = new Map();

  private previewMaterial: THREE.MeshBasicMaterial;
  private activeMaterial: THREE.MeshBasicMaterial;
  private tubeRadius = 0.07;
  private yOffset = 0.12;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.previewGroup = new THREE.Group();
    this.previewGroup.renderOrder = 1000;
    this.scene.add(this.previewGroup);

    this.previewMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x00e5ff),
      transparent: true,
      opacity: 0.9,
    });
    this.previewMaterial.depthTest = false;
    this.previewMaterial.depthWrite = false;
    this.activeMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x44ffd9),
      transparent: true,
      opacity: 0.95,
    });
    this.activeMaterial.depthTest = false;
    this.activeMaterial.depthWrite = false;
  }

  clearAll(): void {
    this.clearPreview();
    this.activePaths.forEach((p) => this.disposePath(p));
    this.activePaths.clear();
  }

  hasActivePath(entityId: number): boolean {
    return this.activePaths.has(entityId);
  }

  clearPreview(): void {
    if (this.previewMesh) {
      this.previewGroup.remove(this.previewMesh);
      this.previewMesh.geometry.dispose();
      this.previewMesh = null;
      this.previewIndexCount = 0;
    }
    this.previewPoints = [];
    this.previewProgress = 0;
  }

  updatePreview(points: THREE.Vector3[]): void {
    // If same target, keep growing; else rebuild
    const changed = !this.samePath(points, this.previewPoints);
    if (changed) {
      this.previewPoints = points.slice();
      this.previewProgress = 0;
      this.pendingPreviewRebuild = true;
    }
  }

  update(deltaTime: number): void {
    // Throttle rebuilds to cut allocations
    if (this.pendingPreviewRebuild && performance.now() - this.lastPreviewRebuild >= this.rebuildIntervalMs) {
      this.rebuildPreviewMesh();
      this.pendingPreviewRebuild = false;
      this.lastPreviewRebuild = performance.now();
    }
    if (!this.previewMesh || this.previewPoints.length < 2) return;
    const segments = this.previewPoints.length - 1;
    if (segments <= 0) return;
    // Grow by segments per second
    const grow = (this.previewSpeed * deltaTime) / Math.max(segments, 1);
    const oldProgress = this.previewProgress;
    this.previewProgress = Math.min(1, this.previewProgress + grow);
    if (this.previewProgress !== oldProgress) {
      const geom = this.previewMesh.geometry as THREE.BufferGeometry;
      this.applyDrawRange(geom, 0, this.progressToCount(this.previewIndexCount, this.previewProgress));
    }
  }

  commitPath(entityId: number, hexes: Hex[], points: THREE.Vector3[]): void {
    // Clear preview if matches
    this.clearPreview();
    const group = new THREE.Group();
    const built = this.buildTube(points, this.activeMaterial);
    let mesh: THREE.Mesh | null = null;
    let indexCount = 0;
    if (built) {
      mesh = built.mesh;
      indexCount = built.indexCount;
      group.add(mesh);
    }
    this.scene.add(group);

    const active: ActivePath & { indexCount: number } = {
      group,
      mesh,
      positions: points.slice(),
      hexes: hexes.slice(),
      indexCount,
    };
    this.activePaths.set(entityId, active);
  }

  trimToHex(entityId: number, currentHex: Hex): void {
    const active = this.activePaths.get(entityId);
    if (!active) return;
    const idx = this.findHexIndex(active.hexes, currentHex);
    if (idx <= 0) return;
    if (idx >= active.hexes.length - 1) {
      // Destination reached; cleanup
      this.disposePath(active);
      this.activePaths.delete(entityId);
      return;
    }

    // Keep remaining path from idx to end
    active.hexes = active.hexes.slice(idx);
    active.positions = active.positions.slice(idx);
    if (active.mesh) {
      const geom = active.mesh.geometry as THREE.BufferGeometry;
      const total = active.indexCount;
      const denom = Math.max(1, active.positions.length - 1);
      const start = this.progressToCount(total, idx / denom);
      this.applyDrawRange(geom, start, total - start);
    }
  }

  private samePath(a: THREE.Vector3[], b: THREE.Vector3[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!a[i].equals(b[i])) return false;
    }
    return true;
  }

  private rebuildPreviewMesh(): void {
    if (this.previewMesh) {
      this.previewGroup.remove(this.previewMesh);
      this.previewMesh.geometry.dispose();
      this.previewMesh = null;
    }
    if (this.previewPoints.length < 2) return;

    // Build full geometry once; reveal via drawRange
    const built = this.buildTube(this.previewPoints, this.previewMaterial);
    if (built) {
      this.previewMesh = built.mesh;
      this.previewIndexCount = built.indexCount;
      this.applyDrawRange(this.previewMesh.geometry as THREE.BufferGeometry, 0, this.progressToCount(this.previewIndexCount, this.previewProgress));
      this.previewGroup.add(this.previewMesh);
    }
  }

  private buildTube(points: THREE.Vector3[], material: THREE.Material): { mesh: THREE.Mesh; indexCount: number } | null {
    if (points.length < 2) return null;
    const elevated = points.map((p) => new THREE.Vector3(p.x, p.y + this.yOffset, p.z));
    const curve = new THREE.CatmullRomCurve3(elevated);
    const tubularSegments = Math.max(8, points.length * 3);
    const geometry = new THREE.TubeGeometry(curve, tubularSegments, this.tubeRadius, 8, false);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.renderOrder = 2000;
    const indexCount = (geometry.index?.count || 0);
    return { mesh, indexCount };
  }

  private applyDrawRange(geometry: THREE.BufferGeometry, start: number, count: number) {
    // Ensure triangle alignment
    const s = Math.max(0, Math.floor(start / 3) * 3);
    const c = Math.max(0, Math.floor(count / 3) * 3);
    geometry.setDrawRange(s, c);
  }

  private progressToCount(indexCount: number, progress: number) {
    return Math.floor(indexCount * THREE.MathUtils.clamp(progress, 0, 1));
  }

  private disposePath(p: ActivePath) {
    if (p.mesh) {
      p.group.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh = null;
    }
    if (p.group.parent) {
      p.group.parent.remove(p.group);
    }
  }

  private findHexIndex(hexes: Hex[], target: Hex): number {
    for (let i = 0; i < hexes.length; i++) {
      const h = hexes[i];
      if (h.col === target.col && h.row === target.row) return i;
    }
    return -1;
  }
}
