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
  private coordinates: HexagonCoordinates;
  private worldPosition: HexagonWorldPosition;
  private instanceId: number;
  private static geometry: THREE.ShapeGeometry | null = null;
  private static material: THREE.MeshLambertMaterial | null = null;

  // Hexagon constants
  public static readonly HEX_HEIGHT = 0.1;

  constructor(col: number, row: number, instanceId: number = -1) {
    this.coordinates = { col, row };
    this.worldPosition = this.calculateWorldPosition(col, row);
    this.instanceId = instanceId;

    // Ensure shared resources are created
    Hexagon.ensureSharedResources();
  }

  private static ensureSharedResources(): void {
    // Create shared geometry if not exists
    if (!Hexagon.geometry) {
      const hexagonShape = createHexagonShape(HEX_SIZE);
      Hexagon.geometry = new THREE.ShapeGeometry(hexagonShape);
    }

    // Create shared material if not exists
    if (!Hexagon.material) {
      Hexagon.material = new THREE.MeshLambertMaterial({
        color: 0x4a90e2,
        transparent: true,
        opacity: 0.8,
        vertexColors: true,
      });
    }
  }

  public static getSharedGeometry(): THREE.ShapeGeometry | null {
    Hexagon.ensureSharedResources();
    return Hexagon.geometry;
  }

  public static getSharedMaterial(): THREE.MeshLambertMaterial | null {
    Hexagon.ensureSharedResources();
    return Hexagon.material;
  }

  private calculateWorldPosition(col: number, row: number): HexagonWorldPosition {
    // Use the proper hex positioning function
    const position = getWorldPositionForHex({ col, row });
    return { x: position.x, z: position.z };
  }

  // Legacy method for backward compatibility - creates individual mesh
  public getMesh(): THREE.Mesh {
    Hexagon.ensureSharedResources();
    if (!Hexagon.geometry || !Hexagon.material) {
      throw new Error("Failed to create shared resources");
    }

    const mesh = new THREE.Mesh(Hexagon.geometry, Hexagon.material);
    mesh.position.set(this.worldPosition.x, Hexagon.HEX_HEIGHT, this.worldPosition.z);
    mesh.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    mesh.userData = { hexagon: this, coordinates: this.coordinates };
    return mesh;
  }

  public getCoordinates(): HexagonCoordinates {
    return this.coordinates;
  }

  public getWorldPosition(): HexagonWorldPosition {
    return this.worldPosition;
  }

  public getInstanceId(): number {
    return this.instanceId;
  }

  public setInstanceId(instanceId: number): void {
    this.instanceId = instanceId;
  }

  public onClick(): void {
    console.log(
      `Hexagon clicked: col=${this.coordinates.col}, row=${this.coordinates.row}, instance=${this.instanceId}`,
    );
  }

  public dispose(): void {
    // Lightweight object, nothing to dispose
    // Shared resources are managed separately
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
