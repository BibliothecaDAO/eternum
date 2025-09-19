import * as THREE from "three";
import { createRoundedHexagonShape } from "../utils/hexagon-geometry";
import { getWorldPositionForHex, HEX_SIZE } from "../utils/utils";

export interface HighlightHex {
  col: number;
  row: number;
  color: THREE.Color;
  pulseSpeed?: number;
  pulseIntensity?: number;
}

export class HighlightRenderer {
  private scene: THREE.Scene;
  private highlightedHexes: Map<string, HighlightHex> = new Map();
  private animationId: number | null = null;
  private biomesManager: any = null; // Will be set by HexagonMap

  private static highlightGeometry: THREE.ShapeGeometry | null = null;
  private static highlightMaterial: THREE.MeshBasicMaterial | null = null;

  private tempVector3 = new THREE.Vector3();
  private tempColor = new THREE.Color();

  private startTime = performance.now();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.initializeStaticAssets();
  }

  public setBiomesManager(biomesManager: any): void {
    this.biomesManager = biomesManager;
  }

  private initializeStaticAssets(): void {
    if (!HighlightRenderer.highlightGeometry) {
      const hexagonShape = createRoundedHexagonShape(HEX_SIZE * 0.975);
      HighlightRenderer.highlightGeometry = new THREE.ShapeGeometry(hexagonShape);
    }

    if (!HighlightRenderer.highlightMaterial) {
      HighlightRenderer.highlightMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        depthTest: false,
      });
    }
  }

  public addHighlight(
    col: number,
    row: number,
    color: THREE.Color,
    pulseSpeed: number = 2.0,
    pulseIntensity: number = 0.3,
  ): void {
    const key = `${col},${row}`;
    
    // Remove existing highlight if it exists
    const existingHighlight = this.highlightedHexes.get(key);
    if (existingHighlight) {
      this.removeHighlightMesh(existingHighlight);
    }
    
    const highlight = {
      col,
      row,
      color: color.clone(),
      pulseSpeed,
      pulseIntensity,
    };
    
    this.highlightedHexes.set(key, highlight);
    this.addHighlightMesh(highlight);
    this.startAnimation();
  }

  public removeHighlight(col: number, row: number): void {
    const key = `${col},${row}`;
    const highlight = this.highlightedHexes.get(key);
    
    if (highlight) {
      // Remove the specific highlight mesh from tile group
      this.removeHighlightMesh(highlight);
      this.highlightedHexes.delete(key);

      if (this.highlightedHexes.size === 0) {
        this.stopAnimation();
      }
    }
  }

  public clearHighlights(): void {
    // Remove all highlight meshes
    this.highlightedHexes.forEach((highlight) => {
      this.removeHighlightMesh(highlight);
    });
    
    this.highlightedHexes.clear();
    this.stopAnimation();
  }

  public setHighlightColor(col: number, row: number, color: THREE.Color): void {
    const key = `${col},${row}`;
    const highlight = this.highlightedHexes.get(key);
    if (highlight) {
      highlight.color.copy(color);
      // Update the mesh color immediately
      this.updateHighlightMeshColor(highlight);
    }
  }

  private addHighlightMesh(highlight: HighlightHex): void {
    const mesh = new THREE.Mesh(
      HighlightRenderer.highlightGeometry!,
      HighlightRenderer.highlightMaterial!.clone()
    );

    // Set the color
    mesh.material.color.copy(highlight.color);

    // Position the mesh relative to the tile group (local coordinates)
    mesh.position.set(0, 0.35, 0.725);
    mesh.rotation.x = -Math.PI / 2;

    // Set render order higher than sprites but lower than the previous 3000
    mesh.renderOrder = 1500;

    // Store reference to the mesh for animation and cleanup
    const hexKey = `${highlight.col},${highlight.row}`;
    mesh.userData.hexKey = hexKey;
    mesh.userData.highlight = highlight;

    // Add to the tile group via biomes manager if available
    if (this.biomesManager && this.biomesManager.renderer && this.biomesManager.renderer.addObjectToTileGroup) {
      this.biomesManager.renderer.addObjectToTileGroup(highlight.col, highlight.row, mesh);
    } else {
      // Fallback to old method if biomesManager is not available
      console.warn("BiomesManager not available, falling back to scene-level rendering");
      getWorldPositionForHex({ col: highlight.col, row: highlight.row }, true, this.tempVector3);
      mesh.position.copy(this.tempVector3);
      mesh.position.y = 0.35;
      this.scene.add(mesh);
    }
  }

  private removeHighlightMesh(highlight: HighlightHex): void {
    if (this.biomesManager && this.biomesManager.renderer && this.biomesManager.renderer.tileGroups) {
      const hexKey = `${highlight.col},${highlight.row}`;
      const tileGroups = this.biomesManager.renderer.tileGroups;
      const group = tileGroups.get(hexKey);
      
      if (group) {
        // Find highlight meshes in the group and remove them
        const highlightMeshes = group.children.filter(
          (child: any) => child.userData && child.userData.hexKey === hexKey,
        );
        highlightMeshes.forEach((mesh: any) => {
          group.remove(mesh);
          if (mesh.material && mesh.material.dispose) {
            mesh.material.dispose();
          }
        });
      }
    }
  }

  private updateHighlightMeshColor(highlight: HighlightHex): void {
    if (this.biomesManager && this.biomesManager.renderer && this.biomesManager.renderer.tileGroups) {
      const hexKey = `${highlight.col},${highlight.row}`;
      const group = this.biomesManager.renderer.tileGroups.get(hexKey);
      if (group) {
        const highlightMesh = group.children.find((child: any) => 
          child.userData && child.userData.hexKey === hexKey
        );
        if (highlightMesh && highlightMesh.material) {
          highlightMesh.material.color.copy(highlight.color);
        }
      }
    }
  }


  private startAnimation(): void {
    if (this.animationId !== null) return;

    this.startTime = performance.now();
    this.animate();
  }

  private stopAnimation(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private animate = (): void => {
    if (this.highlightedHexes.size === 0) {
      this.animationId = null;
      return;
    }

    const currentTime = performance.now();
    const elapsed = (currentTime - this.startTime) / 1000;

    const hexArray = Array.from(this.highlightedHexes.values());

    hexArray.forEach((highlight) => {
      const pulseValue =
        Math.sin(elapsed * highlight.pulseSpeed! * Math.PI) * highlight.pulseIntensity! +
        (1 - highlight.pulseIntensity!);

      this.tempColor.copy(highlight.color);
      this.tempColor.multiplyScalar(pulseValue);

      // Find the mesh for this highlight and update its color
      if (this.biomesManager && this.biomesManager.renderer && this.biomesManager.renderer.tileGroups) {
        const hexKey = `${highlight.col},${highlight.row}`;
        const group = this.biomesManager.renderer.tileGroups.get(hexKey);
        if (group) {
          const highlightMesh = group.children.find((child: any) => child.userData && child.userData.hexKey === hexKey);
          if (highlightMesh && highlightMesh.material) {
            highlightMesh.material.color.copy(this.tempColor);
          }
        }
      }
    });

    this.animationId = requestAnimationFrame(this.animate);
  };

  public dispose(): void {
    this.stopAnimation();
    this.clearHighlights();
  }

  public static disposeStaticAssets(): void {
    if (HighlightRenderer.highlightGeometry) {
      HighlightRenderer.highlightGeometry.dispose();
      HighlightRenderer.highlightGeometry = null;
    }
    if (HighlightRenderer.highlightMaterial) {
      HighlightRenderer.highlightMaterial.dispose();
      HighlightRenderer.highlightMaterial = null;
    }
  }
}
