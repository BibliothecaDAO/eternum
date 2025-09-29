import * as THREE from "three";
import gsap from "gsap";
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
  private highlightMeshes: Map<string, THREE.Mesh> = new Map();
  private materialPool: Map<string, THREE.MeshBasicMaterial> = new Map();
  private materialUsers: Map<string, Set<string>> = new Map();
  private animationId: number | null = null;
  private biomesManager: any = null; // Will be set by HexagonMap
  private highlightTimeline: gsap.core.Timeline | null = null;
  private activeLaunchGlows: Array<{ mesh: THREE.Mesh; material: THREE.MeshBasicMaterial }> = [];
  private readonly rolloutConfig = {
    stepDelay: 0.02,
    entryDuration: 0.18,
    initialScale: 0.01,
    ease: "power2.out",
  };

  private static highlightGeometry: THREE.ShapeGeometry | null = null;

  private tempVector3 = new THREE.Vector3();

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
  }

  private generateMaterialKey(color: THREE.Color, pulseSpeed: number, pulseIntensity: number): string {
    return `${color.getHex()}_${pulseSpeed}_${pulseIntensity}`;
  }

  private getOrCreateMaterial(color: THREE.Color, pulseSpeed: number, pulseIntensity: number): THREE.MeshBasicMaterial {
    const colorKey = this.generateMaterialKey(color, pulseSpeed, pulseIntensity);

    let material = this.materialPool.get(colorKey);
    if (!material) {
      material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        depthTest: false,
      });
      this.materialPool.set(colorKey, material);
      this.materialUsers.set(colorKey, new Set());
    }

    return material;
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
      color,
      pulseSpeed,
      pulseIntensity,
    };

    this.highlightedHexes.set(key, highlight);
    this.addHighlightMesh(highlight);
    this.startAnimation();
  }

  public highlightHexes(highlights: HighlightHex[]): void {
    this.highlightTimeline?.kill();
    this.highlightTimeline = null;
    this.cleanupLaunchGlows();

    // Remove existing highlights
    this.clearHighlights();

    if (highlights.length === 0) return;

    const timeline = gsap.timeline();

    highlights.forEach((highlight, index) => {
      const key = `${highlight.col},${highlight.row}`;
      
      // Create highlight with initial hidden state
      this.highlightedHexes.set(key, highlight);
      const mesh = this.addHighlightMeshForRollout(highlight);
      
      if (!mesh) return;

      const startTime = index * this.rolloutConfig.stepDelay;

      timeline.add(() => {
        mesh.visible = true;
      }, startTime);

      timeline.to(
        mesh.scale,
        {
          x: 1,
          y: 1,
          z: 1,
          duration: this.rolloutConfig.entryDuration,
          ease: this.rolloutConfig.ease,
        },
        startTime,
      );

      if (index === 0) {
        this.triggerLaunchGlow(highlight, timeline, startTime);
      }
    });

    this.highlightTimeline = timeline;
    this.startAnimation();
  }

  private releaseMaterial(highlight: HighlightHex, hexKey: string): void {
    const colorKey = this.generateMaterialKey(highlight.color, highlight.pulseSpeed!, highlight.pulseIntensity!);
    const users = this.materialUsers.get(colorKey);
    if (users) {
      users.delete(hexKey);
      if (users.size === 0) {
        const material = this.materialPool.get(colorKey);
        if (material) {
          material.dispose();
          this.materialPool.delete(colorKey);
          this.materialUsers.delete(colorKey);
        }
      }
    }
  }

  public removeHighlight(col: number, row: number): void {
    const key = `${col},${row}`;
    const highlight = this.highlightedHexes.get(key);

    if (highlight) {
      // Remove the specific highlight mesh from tile group
      this.removeHighlightMesh(highlight);
      this.releaseMaterial(highlight, key);
      this.highlightedHexes.delete(key);
      this.highlightMeshes.delete(key);

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

    // Dispose all materials
    this.materialPool.forEach((material) => material.dispose());
    this.materialPool.clear();
    this.materialUsers.clear();

    this.highlightedHexes.clear();
    this.highlightMeshes.clear();
    this.stopAnimation();
  }

  public setHighlightColor(col: number, row: number, color: THREE.Color): void {
    const key = `${col},${row}`;
    const highlight = this.highlightedHexes.get(key);
    if (highlight) {
      // Release old material and get new one
      this.releaseMaterial(highlight, key);
      highlight.color = color;

      const material = this.getOrCreateMaterial(color, highlight.pulseSpeed!, highlight.pulseIntensity!);
      const colorKey = this.generateMaterialKey(color, highlight.pulseSpeed!, highlight.pulseIntensity!);
      this.materialUsers.get(colorKey)!.add(key);

      const mesh = this.highlightMeshes.get(key);
      if (mesh) {
        mesh.material = material;
      }
    }
  }

  private createHighlightMesh(highlight: HighlightHex, isRollout: boolean = false): THREE.Mesh {
    const material = this.getOrCreateMaterial(highlight.color, highlight.pulseSpeed!, highlight.pulseIntensity!);
    const colorKey = this.generateMaterialKey(highlight.color, highlight.pulseSpeed!, highlight.pulseIntensity!);
    const hexKey = `${highlight.col},${highlight.row}`;

    // Track this hex as using this material
    this.materialUsers.get(colorKey)!.add(hexKey);

    const mesh = new THREE.Mesh(HighlightRenderer.highlightGeometry!, material);

    // Position the mesh relative to the tile group (local coordinates)
    mesh.position.set(0, 0.35, 0.785);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 1500;

    if (isRollout) {
      mesh.visible = false;
      mesh.scale.setScalar(this.rolloutConfig.initialScale);
      mesh.raycast = () => {};
    }

    // Store reference to the mesh for animation and cleanup
    mesh.userData.hexKey = hexKey;
    mesh.userData.highlight = highlight;

    // Store mesh reference for direct access
    this.highlightMeshes.set(hexKey, mesh);

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

    return mesh;
  }

  private addHighlightMesh(highlight: HighlightHex): void {
    this.createHighlightMesh(highlight, false);
  }

  private addHighlightMeshForRollout(highlight: HighlightHex): THREE.Mesh {
    return this.createHighlightMesh(highlight, true);
  }

  private removeHighlightMesh(highlight: HighlightHex): void {
    const hexKey = `${highlight.col},${highlight.row}`;
    const mesh = this.highlightMeshes.get(hexKey);

    if (!mesh) return;

    if (this.biomesManager && this.biomesManager.renderer && this.biomesManager.renderer.tileGroups) {
      const tileGroups = this.biomesManager.renderer.tileGroups;
      const group = tileGroups.get(hexKey);

      if (group) {
        group.remove(mesh);
      }
    } else {
      this.scene.remove(mesh);
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

    // Check if any highlights need pulsing animation
    let needsPulsing = false;
    for (const highlight of this.highlightedHexes.values()) {
      if (highlight.pulseIntensity && highlight.pulseIntensity > 0) {
        needsPulsing = true;
        break;
      }
    }

    if (!needsPulsing) {
      this.animationId = requestAnimationFrame(this.animate);
      return;
    }

    const currentTime = performance.now();
    const elapsed = (currentTime - this.startTime) / 1000;

    // Group highlights by material key to animate each material only once
    const materialAnimations = new Map<
      string,
      { material: THREE.MeshBasicMaterial; baseColor: THREE.Color; pulseSpeed: number; pulseIntensity: number }
    >();

    this.highlightedHexes.forEach((highlight) => {
      if (!highlight.pulseIntensity || highlight.pulseIntensity <= 0) return;
      
      const colorKey = this.generateMaterialKey(highlight.color, highlight.pulseSpeed!, highlight.pulseIntensity!);
      if (!materialAnimations.has(colorKey)) {
        const material = this.materialPool.get(colorKey);
        if (material) {
          materialAnimations.set(colorKey, {
            material,
            baseColor: highlight.color,
            pulseSpeed: highlight.pulseSpeed!,
            pulseIntensity: highlight.pulseIntensity!,
          });
        }
      }
    });

    // Animate each unique material once
    materialAnimations.forEach(({ material, baseColor, pulseSpeed, pulseIntensity }) => {
      const pulseValue = Math.sin(elapsed * pulseSpeed * Math.PI) * pulseIntensity + (1 - pulseIntensity);
      material.color.copy(baseColor).multiplyScalar(pulseValue);
    });

    this.animationId = requestAnimationFrame(this.animate);
  };

  private triggerLaunchGlow(highlight: HighlightHex, timeline: gsap.core.Timeline, startTime: number): void {
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: highlight.color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });

    const glowMesh = new THREE.Mesh(HighlightRenderer.highlightGeometry!, glowMaterial);
    
    // Position the glow mesh
    if (this.biomesManager && this.biomesManager.renderer && this.biomesManager.renderer.addObjectToTileGroup) {
      glowMesh.position.set(0, 0.35, 0.785);
      glowMesh.rotation.x = -Math.PI / 2;
      glowMesh.scale.setScalar(0.45);
      glowMesh.raycast = () => {};
      this.biomesManager.renderer.addObjectToTileGroup(highlight.col, highlight.row, glowMesh);
    } else {
      getWorldPositionForHex({ col: highlight.col, row: highlight.row }, true, this.tempVector3);
      glowMesh.position.copy(this.tempVector3);
      glowMesh.position.y = 0.35;
      glowMesh.rotation.x = -Math.PI / 2;
      glowMesh.scale.setScalar(0.45);
      glowMesh.raycast = () => {};
      this.scene.add(glowMesh);
    }

    const glowEntry = { mesh: glowMesh, material: glowMaterial };
    this.activeLaunchGlows.push(glowEntry);

    timeline.to(
      glowMaterial,
      {
        opacity: 0.85,
        duration: 0.12,
        ease: "power2.out",
      },
      startTime,
    );

    timeline.to(
      glowMaterial,
      {
        opacity: 0,
        duration: 0.24,
        ease: "power1.out",
      },
      startTime + 0.12,
    );

    timeline.to(
      glowMesh.scale,
      {
        x: 1.55,
        y: 1.55,
        z: 1.55,
        duration: 0.3,
        ease: "power2.out",
      },
      startTime,
    );

    timeline.add(() => this.removeLaunchGlow(glowEntry), startTime + 0.36);
  }

  private removeLaunchGlow(entry: { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial }): void {
    const index = this.activeLaunchGlows.indexOf(entry);
    if (index >= 0) {
      this.activeLaunchGlows.splice(index, 1);
    }

    if (entry.mesh.parent) {
      entry.mesh.parent.remove(entry.mesh);
    }

    entry.material.dispose();
  }

  private cleanupLaunchGlows(): void {
    this.activeLaunchGlows.forEach((entry) => {
      if (entry.mesh.parent) {
        entry.mesh.parent.remove(entry.mesh);
      }

      entry.material.dispose();
    });

    this.activeLaunchGlows = [];
  }

  public dispose(): void {
    this.highlightTimeline?.kill();
    this.highlightTimeline = null;
    this.cleanupLaunchGlows();
    this.stopAnimation();
    this.clearHighlights();
  }

  public static disposeStaticAssets(): void {
    if (HighlightRenderer.highlightGeometry) {
      HighlightRenderer.highlightGeometry.dispose();
      HighlightRenderer.highlightGeometry = null;
    }
  }
}
