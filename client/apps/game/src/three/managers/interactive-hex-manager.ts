import { HEX_SIZE } from "@/three/constants";
import { createHexagonShape } from "@/three/geometry/hexagon-geometry";
import { Aura } from "@/three/managers/aura";
import { HoverHexManager } from "@/three/managers/hover-hex-manager";
import { interactiveHexMaterial } from "@/three/shaders/border-hex-material";
import { hexGeometryDebugger } from "@/three/utils/hex-geometry-debug";
import { HexGeometryPool } from "@/three/utils/hex-geometry-pool";
import * as THREE from "three";
import { getHexagonCoordinates, getWorldPositionForHex } from "../utils";

export class InteractiveHexManager {
  private scene: THREE.Scene;
  // Store all interactive hexes
  private allHexes: Set<string> = new Set();
  private hexBuckets: Map<string, Set<string>> = new Map();
  // Store only currently visible hexes for the current chunk
  private visibleHexes: Set<string> = new Set();
  private instanceMesh: THREE.InstancedMesh | null = null;
  private hoverAura: Aura;
  private hoverHexManager: HoverHexManager;
  private matrix = new THREE.Matrix4();
  private position = new THREE.Vector3();
  private dummy = new THREE.Object3D();
  private showAura: boolean = true;
  private useRimLighting: boolean = true; // New feature flag
  private hexGeometryPool: HexGeometryPool;
  private readonly bucketSize = 16;
  private instanceCapacity = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.hoverAura = new Aura();
    this.hoverHexManager = new HoverHexManager(scene);
    this.hexGeometryPool = HexGeometryPool.getInstance();
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onClick = this.onClick.bind(this);
  }

  public setAuraVisibility(visible: boolean) {
    this.showAura = visible;
    if (!visible) {
      if (this.hoverAura.isInScene(this.scene)) {
        this.hoverAura.removeFromScene(this.scene);
      }
      this.hoverHexManager.hideHover();
    }
  }

  public toggleAura() {
    this.setAuraVisibility(!this.showAura);
  }

  public isAuraVisible(): boolean {
    return this.showAura;
  }

  /**
   * Toggle between rim lighting and classic aura hover effects
   */
  public setRimLighting(enabled: boolean) {
    this.useRimLighting = enabled;
    // Hide current effects when switching
    if (this.hoverAura.isInScene(this.scene)) {
      this.hoverAura.removeFromScene(this.scene);
    }
    this.hoverHexManager.hideHover();
  }

  public toggleRimLighting() {
    this.setRimLighting(!this.useRimLighting);
  }

  public isRimLightingEnabled(): boolean {
    return this.useRimLighting;
  }

  /**
   * Set hover effect colors (for rim lighting mode)
   */
  public setHoverColors(baseColor: THREE.Color, rimColor: THREE.Color) {
    this.hoverHexManager.setHoverColor(baseColor, rimColor);
  }

  /**
   * Set hover effect intensity (0.0 to 1.0)
   */
  public setHoverIntensity(intensity: number) {
    this.hoverHexManager.setHoverIntensity(intensity);
  }

  public onMouseMove(raycaster: THREE.Raycaster) {
    if (!this.instanceMesh) return;
    const intersects = raycaster.intersectObjects([this.instanceMesh], true);
    if (intersects.length > 0) {
      const intersect = intersects[0];
      const intersectedObject = intersect.object;
      if (intersectedObject instanceof THREE.InstancedMesh) {
        const instanceId = intersect.instanceId;
        if (instanceId !== undefined) {
          const hoveredHex = getHexagonCoordinates(intersectedObject, instanceId);
          intersectedObject.getMatrixAt(instanceId, this.matrix);

          this.position.setFromMatrixPosition(this.matrix);

          if (this.showAura) {
            if (this.useRimLighting) {
              // Use new rim lighting hover effect
              this.hoverHexManager.showHover(this.position.x, this.position.z);
              // Hide old aura if it's visible
              if (this.hoverAura.isInScene(this.scene)) {
                this.hoverAura.removeFromScene(this.scene);
              }
            } else {
              // Use original aura system
              this.hoverAura.setPosition(this.position.x, 0.3, this.position.z);
              if (!this.hoverAura.isInScene(this.scene)) {
                this.hoverAura.addToScene(this.scene);
              }
              // Hide rim lighting if it's visible
              this.hoverHexManager.hideHover();
            }
          }
          return hoveredHex;
        }
      }
    } else {
      // Hide both hover effects when not hovering
      if (this.hoverAura.isInScene(this.scene)) {
        this.hoverAura.removeFromScene(this.scene);
      }
      this.hoverHexManager.hideHover();
      return null;
    }
  }

  public onClick(raycaster: THREE.Raycaster) {
    if (!this.instanceMesh) return;
    const intersects = raycaster.intersectObjects([this.instanceMesh], true);
    if (intersects.length > 0) {
      const intersect = intersects[0];
      const intersectedObject = intersect.object;
      if (intersectedObject instanceof THREE.InstancedMesh) {
        const instanceId = intersect.instanceId;
        if (instanceId !== undefined) {
          return getHexagonCoordinates(intersectedObject, instanceId);
        }
      }
    }
  }

  private getBucketKey(col: number, row: number): string {
    const bucketCol = Math.floor(col / this.bucketSize);
    const bucketRow = Math.floor(row / this.bucketSize);
    return `${bucketCol},${bucketRow}`;
  }

  private ensureInstanceMeshCapacity(minCapacity: number) {
    const requiredCapacity = Math.max(1, Math.floor(minCapacity));

    if (this.instanceMesh && requiredCapacity <= this.instanceCapacity) {
      return;
    }

    if (this.instanceMesh) {
      this.scene.remove(this.instanceMesh);

      if (this.instanceMesh.geometry) {
        this.hexGeometryPool.releaseGeometry("interactive");
      }

      this.instanceMesh = null;
      this.instanceCapacity = 0;
    }

    const hexagonGeometry = this.hexGeometryPool.getGeometry("interactive");
    hexGeometryDebugger.trackSharedGeometryUsage("interactive", "InteractiveHexManager.ensureInstanceMeshCapacity");

    const mesh = new THREE.InstancedMesh(hexagonGeometry, interactiveHexMaterial, requiredCapacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;

    this.instanceMesh = mesh;
    this.instanceCapacity = requiredCapacity;
    this.scene.add(mesh);
  }

  // Add hex to the global collection of all interactive hexes
  addHex(hex: { col: number; row: number }) {
    const key = `${hex.col},${hex.row}`;
    if (this.allHexes.has(key)) {
      return;
    }

    this.allHexes.add(key);

    const bucketKey = this.getBucketKey(hex.col, hex.row);
    const bucket = this.hexBuckets.get(bucketKey) ?? new Set<string>();
    bucket.add(key);
    this.hexBuckets.set(bucketKey, bucket);
  }

  // Filter visible hexes for the current chunk
  updateVisibleHexes(startRow: number, startCol: number, width: number, height: number) {
    this.visibleHexes.clear();

    // Calculate chunk boundaries
    const halfWidth = Math.max(0, width) / 2;
    const halfHeight = Math.max(0, height) / 2;
    const minCol = startCol - halfWidth;
    const maxCol = startCol + halfWidth;
    const minRow = startRow - halfHeight;
    const maxRow = startRow + halfHeight;

    const minBucketCol = Math.floor(minCol / this.bucketSize);
    const maxBucketCol = Math.floor(maxCol / this.bucketSize);
    const minBucketRow = Math.floor(minRow / this.bucketSize);
    const maxBucketRow = Math.floor(maxRow / this.bucketSize);

    for (let bucketCol = minBucketCol; bucketCol <= maxBucketCol; bucketCol++) {
      for (let bucketRow = minBucketRow; bucketRow <= maxBucketRow; bucketRow++) {
        const bucketKey = `${bucketCol},${bucketRow}`;
        const bucket = this.hexBuckets.get(bucketKey);
        if (!bucket) continue;

        bucket.forEach((hexString) => {
          const [col, row] = hexString.split(",").map(Number);
          if (col >= minCol && col <= maxCol && row >= minRow && row <= maxRow) {
            this.visibleHexes.add(hexString);
          }
        });
      }
    }

    const capacityHint = Math.max(1, Math.ceil(width) * Math.ceil(height));
    this.ensureInstanceMeshCapacity(Math.max(capacityHint, this.visibleHexes.size));

    // Render only the visible hexes
    this.renderHexes();
  }

  // Clear all interactive hexes (e.g., when resetting the world)
  clearHexes() {
    this.allHexes.clear();
    this.visibleHexes.clear();
    this.hexBuckets.clear();

    if (this.instanceMesh) {
      this.instanceMesh.count = 0;
      this.instanceMesh.instanceMatrix.needsUpdate = true;
    }
  }

  // For backward compatibility with Hexception scene
  // Renders all hexes in the allHexes collection
  renderAllHexes() {
    const instanceCount = this.allHexes.size;
    this.ensureInstanceMeshCapacity(Math.max(instanceCount, 1));

    if (!this.instanceMesh) {
      return;
    }

    const mesh = this.instanceMesh;
    mesh.count = instanceCount;

    if (instanceCount === 0) {
      mesh.instanceMatrix.needsUpdate = true;
      return;
    }

    let index = 0;
    this.allHexes.forEach((hexString) => {
      const [col, row] = hexString.split(",").map(Number);
      const position = getWorldPositionForHex({ col, row });
      this.dummy.position.set(position.x, 0.1, position.z);
      this.dummy.rotation.x = -Math.PI / 2;
      this.dummy.updateMatrix();
      mesh.setMatrixAt(index, this.dummy.matrix);
      index++;
    });

    mesh.instanceMatrix.needsUpdate = true;
  }

  renderHexes() {
    if (!this.instanceMesh) {
      return;
    }

    const instanceCount = this.visibleHexes.size;
    const mesh = this.instanceMesh;
    mesh.count = instanceCount;

    if (instanceCount === 0) {
      mesh.instanceMatrix.needsUpdate = true;
      return;
    }

    let index = 0;
    this.visibleHexes.forEach((hexString) => {
      const [col, row] = hexString.split(",").map(Number);
      const position = getWorldPositionForHex({ col, row });
      this.dummy.position.set(position.x, 0.1, position.z);
      this.dummy.rotation.x = -Math.PI / 2;
      this.dummy.updateMatrix();
      mesh.setMatrixAt(index, this.dummy.matrix);
      index++;
    });

    mesh.instanceMatrix.needsUpdate = true;
  }

  update() {
    this.hoverAura.rotate();
  }

  public destroy(): void {
    // Clean up instance mesh
    if (this.instanceMesh) {
      this.scene.remove(this.instanceMesh);

      // Release shared geometry reference instead of disposing
      if (this.instanceMesh.geometry) {
        this.hexGeometryPool.releaseGeometry("interactive");
      }

      this.instanceMesh = null;
      this.instanceCapacity = 0;
    }

    // Clean up hover effects
    if (this.hoverAura.isInScene(this.scene)) {
      this.hoverAura.removeFromScene(this.scene);
    }
    this.hoverHexManager.dispose();

    // Clear hex collections
    this.allHexes.clear();
    this.visibleHexes.clear();
    this.hexBuckets.clear();

    console.log("InteractiveHexManager: Destroyed and cleaned up");
  }
}
