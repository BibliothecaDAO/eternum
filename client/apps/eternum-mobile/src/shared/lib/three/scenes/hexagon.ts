import * as THREE from "three";
import { createHexagonShape } from "./hexagon-geometry";
import { getWorldPositionForHex, HEX_SIZE } from "./utils";

export interface HexagonCoordinates {
  col: number;
  row: number;
}

export interface HexagonWorldPosition {
  x: number;
  z: number;
}

export class Hexagon {
  private mesh: THREE.Mesh;
  private coordinates: HexagonCoordinates;
  private worldPosition: HexagonWorldPosition;
  private static geometry: THREE.ShapeGeometry | null = null;
  private static material: THREE.MeshLambertMaterial | null = null;

  // Hexagon constants
  private static readonly HEX_HEIGHT = 0.1;

  constructor(col: number, row: number) {
    this.coordinates = { col, row };
    this.worldPosition = this.calculateWorldPosition(col, row);

    // Create shared geometry and material if not exists
    if (!Hexagon.geometry) {
      const hexagonShape = createHexagonShape(HEX_SIZE);
      Hexagon.geometry = new THREE.ShapeGeometry(hexagonShape);
    }

    if (!Hexagon.material) {
      Hexagon.material = new THREE.MeshLambertMaterial({
        color: 0x4a90e2,
        transparent: true,
        opacity: 0.8,
      });
    }

    // Create mesh
    this.mesh = new THREE.Mesh(Hexagon.geometry, Hexagon.material);
    this.mesh.position.set(this.worldPosition.x, Hexagon.HEX_HEIGHT, this.worldPosition.z);
    this.mesh.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    this.mesh.userData = { hexagon: this, coordinates: this.coordinates };
  }

  private calculateWorldPosition(col: number, row: number): HexagonWorldPosition {
    // Use the proper hex positioning function
    const position = getWorldPositionForHex({ col, row });
    return { x: position.x, z: position.z };
  }

  public getMesh(): THREE.Mesh {
    return this.mesh;
  }

  public getCoordinates(): HexagonCoordinates {
    return this.coordinates;
  }

  public getWorldPosition(): HexagonWorldPosition {
    return this.worldPosition;
  }

  public onClick(): void {
    console.log(`Hexagon clicked: col=${this.coordinates.col}, row=${this.coordinates.row}`);

    // Visual feedback - temporarily change color
    const originalColor = (this.mesh.material as THREE.MeshLambertMaterial).color.getHex();
    (this.mesh.material as THREE.MeshLambertMaterial).color.setHex(0xff6b6b);

    setTimeout(() => {
      (this.mesh.material as THREE.MeshLambertMaterial).color.setHex(originalColor);
    }, 200);
  }

  public setVisible(visible: boolean): void {
    this.mesh.visible = visible;
  }

  public dispose(): void {
    // Don't dispose shared geometry and material
    // They will be disposed when the last hexagon is disposed
  }

  public static disposeSharedResources(): void {
    if (Hexagon.geometry) {
      Hexagon.geometry.dispose();
      Hexagon.geometry = null;
    }
    if (Hexagon.material) {
      Hexagon.material.dispose();
      Hexagon.material = null;
    }
  }
}
