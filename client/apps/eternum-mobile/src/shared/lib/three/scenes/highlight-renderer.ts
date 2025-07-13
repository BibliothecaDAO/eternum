import * as THREE from "three";
import { createHexagonShape } from "./hexagon-geometry";
import { getWorldPositionForHex, HEX_SIZE } from "./utils";

export interface HighlightHex {
  col: number;
  row: number;
  color: THREE.Color;
  pulseSpeed?: number;
  pulseIntensity?: number;
}

export class HighlightRenderer {
  private scene: THREE.Scene;
  private highlightMesh: THREE.InstancedMesh | null = null;
  private highlightedHexes: Map<string, HighlightHex> = new Map();
  private animationId: number | null = null;

  private static highlightGeometry: THREE.ShapeGeometry | null = null;
  private static highlightMaterial: THREE.MeshLambertMaterial | null = null;

  private dummy = new THREE.Object3D();
  private tempVector3 = new THREE.Vector3();
  private tempColor = new THREE.Color();

  private startTime = performance.now();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.initializeStaticAssets();
  }

  private initializeStaticAssets(): void {
    if (!HighlightRenderer.highlightGeometry) {
      const hexagonShape = createHexagonShape(HEX_SIZE * 1.1);
      HighlightRenderer.highlightGeometry = new THREE.ShapeGeometry(hexagonShape);
    }

    if (!HighlightRenderer.highlightMaterial) {
      HighlightRenderer.highlightMaterial = new THREE.MeshLambertMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.6,
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
    this.highlightedHexes.set(key, {
      col,
      row,
      color: color.clone(),
      pulseSpeed,
      pulseIntensity,
    });
    this.updateHighlightMesh();
    this.startAnimation();
  }

  public removeHighlight(col: number, row: number): void {
    const key = `${col},${row}`;
    this.highlightedHexes.delete(key);
    this.updateHighlightMesh();

    if (this.highlightedHexes.size === 0) {
      this.stopAnimation();
    }
  }

  public clearHighlights(): void {
    this.highlightedHexes.clear();
    this.updateHighlightMesh();
    this.stopAnimation();
  }

  public setHighlightColor(col: number, row: number, color: THREE.Color): void {
    const key = `${col},${row}`;
    const highlight = this.highlightedHexes.get(key);
    if (highlight) {
      highlight.color.copy(color);
    }
  }

  private updateHighlightMesh(): void {
    if (this.highlightMesh) {
      this.scene.remove(this.highlightMesh);
      this.highlightMesh.dispose();
      this.highlightMesh = null;
    }

    if (this.highlightedHexes.size === 0) {
      return;
    }

    const instanceCount = this.highlightedHexes.size;
    this.highlightMesh = new THREE.InstancedMesh(
      HighlightRenderer.highlightGeometry!,
      HighlightRenderer.highlightMaterial!,
      instanceCount,
    );

    this.highlightMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(instanceCount * 3), 3);

    const hexArray = Array.from(this.highlightedHexes.values());
    hexArray.sort((a, b) => b.row - a.row);

    hexArray.forEach((highlight, index) => {
      getWorldPositionForHex({ col: highlight.col, row: highlight.row }, true, this.tempVector3);

      this.dummy.position.copy(this.tempVector3);
      this.dummy.position.y = 0.25;
      this.dummy.rotation.x = -Math.PI / 2;
      this.dummy.updateMatrix();

      this.highlightMesh!.setMatrixAt(index, this.dummy.matrix);
      this.highlightMesh!.setColorAt(index, highlight.color);
    });

    this.highlightMesh.instanceColor!.needsUpdate = true;
    this.highlightMesh.renderOrder = 2000;
    this.scene.add(this.highlightMesh);
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
    if (!this.highlightMesh || this.highlightedHexes.size === 0) {
      this.animationId = null;
      return;
    }

    const currentTime = performance.now();
    const elapsed = (currentTime - this.startTime) / 1000;

    const hexArray = Array.from(this.highlightedHexes.values());

    hexArray.forEach((highlight, index) => {
      const pulseValue =
        Math.sin(elapsed * highlight.pulseSpeed! * Math.PI) * highlight.pulseIntensity! +
        (1 - highlight.pulseIntensity!);

      this.tempColor.copy(highlight.color);
      this.tempColor.multiplyScalar(pulseValue);

      this.highlightMesh!.setColorAt(index, this.tempColor);
    });

    this.highlightMesh.instanceColor!.needsUpdate = true;
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
