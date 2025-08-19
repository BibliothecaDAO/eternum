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

  // Add hex to the global collection of all interactive hexes
  addHex(hex: { col: number; row: number }) {
    const key = `${hex.col},${hex.row}`;
    this.allHexes.add(key);
  }

  // Filter visible hexes for the current chunk
  updateVisibleHexes(startRow: number, startCol: number, width: number, height: number) {
    this.visibleHexes.clear();

    // Calculate chunk boundaries
    const minCol = startCol - width / 2;
    const maxCol = startCol + width / 2;
    const minRow = startRow - height / 2;
    const maxRow = startRow + height / 2;

    // Filter hexes within current chunk bounds
    this.allHexes.forEach((hexString) => {
      const [col, row] = hexString.split(",").map(Number);
      if (col >= minCol && col <= maxCol && row >= minRow && row <= maxRow) {
        this.visibleHexes.add(hexString);
      }
    });

    // Render only the visible hexes
    this.renderHexes();
  }

  // Clear all interactive hexes (e.g., when resetting the world)
  clearHexes() {
    this.allHexes.clear();
    this.visibleHexes.clear();
  }

  // For backward compatibility with Hexception scene
  // Renders all hexes in the allHexes collection
  renderAllHexes() {
    if (this.instanceMesh) {
      this.scene.remove(this.instanceMesh);
      // Release shared geometry reference instead of disposing
      if (this.instanceMesh.geometry) {
        this.hexGeometryPool.releaseGeometry("interactive");
      }
      if (this.instanceMesh.material) {
        if (Array.isArray(this.instanceMesh.material)) {
          this.instanceMesh.material.forEach((mat) => mat.dispose());
        } else {
          this.instanceMesh.material.dispose();
        }
      }
      this.instanceMesh = null;
    }

    // Use shared geometry instead of creating new one
    const hexagonGeometry = this.hexGeometryPool.getGeometry("interactive");
    hexGeometryDebugger.trackSharedGeometryUsage("interactive", "InteractiveHexManager.renderAllHexes");
    const instanceCount = this.allHexes.size;

    if (instanceCount === 0) return;

    this.instanceMesh = new THREE.InstancedMesh(hexagonGeometry, interactiveHexMaterial, instanceCount);

    let index = 0;
    this.allHexes.forEach((hexString) => {
      const [col, row] = hexString.split(",").map(Number);
      const position = getWorldPositionForHex({ col, row });
      this.dummy.position.set(position.x, 0.1, position.z);
      this.dummy.rotation.x = -Math.PI / 2;
      this.dummy.updateMatrix();
      this.instanceMesh!.setMatrixAt(index, this.dummy.matrix);
      index++;
    });

    this.scene.add(this.instanceMesh);
  }

  renderHexes() {
    if (this.instanceMesh) {
      this.scene.remove(this.instanceMesh);
      // Release shared geometry reference instead of disposing
      if (this.instanceMesh.geometry) {
        this.hexGeometryPool.releaseGeometry("interactive");
      }
      if (this.instanceMesh.material) {
        if (Array.isArray(this.instanceMesh.material)) {
          this.instanceMesh.material.forEach((mat) => mat.dispose());
        } else {
          this.instanceMesh.material.dispose();
        }
      }
      this.instanceMesh = null;
    }

    // Use shared geometry instead of creating new one
    const hexagonGeometry = this.hexGeometryPool.getGeometry("interactive");
    hexGeometryDebugger.trackSharedGeometryUsage("interactive", "InteractiveHexManager.renderHexes");
    const instanceCount = this.visibleHexes.size;

    if (instanceCount === 0) return;

    this.instanceMesh = new THREE.InstancedMesh(hexagonGeometry, interactiveHexMaterial, instanceCount);

    let index = 0;
    this.visibleHexes.forEach((hexString) => {
      const [col, row] = hexString.split(",").map(Number);
      const position = getWorldPositionForHex({ col, row });
      this.dummy.position.set(position.x, 0.1, position.z);
      this.dummy.rotation.x = -Math.PI / 2;
      this.dummy.updateMatrix();
      this.instanceMesh!.setMatrixAt(index, this.dummy.matrix);
      index++;
    });

    this.scene.add(this.instanceMesh);
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

      if (this.instanceMesh.material) {
        if (Array.isArray(this.instanceMesh.material)) {
          this.instanceMesh.material.forEach((mat) => mat.dispose());
        } else {
          this.instanceMesh.material.dispose();
        }
      }
      this.instanceMesh = null;
    }

    // Clean up hover effects
    if (this.hoverAura.isInScene(this.scene)) {
      this.hoverAura.removeFromScene(this.scene);
    }
    this.hoverHexManager.dispose();

    // Clear hex collections
    this.allHexes.clear();
    this.visibleHexes.clear();

    console.log("InteractiveHexManager: Destroyed and cleaned up");
  }
}
