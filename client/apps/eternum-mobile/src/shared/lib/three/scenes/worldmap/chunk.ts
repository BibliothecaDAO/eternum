import * as THREE from "three";
import { Hexagon } from "./hexagon";
import { getWorldPositionForHex } from "./utils";

export interface ChunkCoordinates {
  x: number;
  z: number;
}

export class Chunk {
  private coordinates: ChunkCoordinates;
  private hexagons: Map<string, Hexagon>;
  private group: THREE.Group;
  private isLoaded: boolean;
  private instancedMesh: THREE.InstancedMesh | null = null;

  // Chunk constants
  public static readonly CHUNK_SIZE = 5; // 5x5 hexagons per chunk
  private static readonly HEXAGONS_PER_CHUNK = Chunk.CHUNK_SIZE * Chunk.CHUNK_SIZE;

  // Reusable objects to avoid creation in loops
  private static readonly _tempMatrix = new THREE.Matrix4();
  private static readonly _tempPosition = new THREE.Vector3();
  private static readonly _tempQuaternion = new THREE.Quaternion();
  private static readonly _tempScale = new THREE.Vector3(1, 1, 1);
  private static readonly _tempAxisX = new THREE.Vector3(1, 0, 0);

  // Default colors as constants to avoid recalculation
  private static readonly DEFAULT_COLOR = 0x4a90e2;
  private static readonly CLICK_COLOR = 0xff6b6b;

  constructor(chunkX: number, chunkZ: number) {
    this.coordinates = { x: chunkX, z: chunkZ };
    this.hexagons = new Map();
    this.group = new THREE.Group();
    this.isLoaded = false;

    this.group.userData = { chunk: this, coordinates: this.coordinates };
  }

  public load(): void {
    if (this.isLoaded) return;

    // Get shared geometry and material from Hexagon class
    const geometry = Hexagon.getSharedGeometry();
    const material = Hexagon.getSharedMaterial();

    if (!geometry || !material) {
      console.error("Shared hexagon resources not available");
      return;
    }

    // Create instanced mesh for all hexagons in this chunk
    this.instancedMesh = new THREE.InstancedMesh(geometry, material, Chunk.HEXAGONS_PER_CHUNK);
    this.instancedMesh.userData = { chunk: this };

    // Setup instance color attribute for per-hexagon coloring
    const colors = new Float32Array(Chunk.HEXAGONS_PER_CHUNK * 3);
    // Initialize all instances with default color
    const defaultR = ((Chunk.DEFAULT_COLOR >> 16) & 255) / 255;
    const defaultG = ((Chunk.DEFAULT_COLOR >> 8) & 255) / 255;
    const defaultB = (Chunk.DEFAULT_COLOR & 255) / 255;

    for (let i = 0; i < Chunk.HEXAGONS_PER_CHUNK; i++) {
      colors[i * 3] = defaultR;
      colors[i * 3 + 1] = defaultG;
      colors[i * 3 + 2] = defaultB;
    }
    this.instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);

    // Calculate hexagon coordinates for this chunk
    const startCol = this.coordinates.x * Chunk.CHUNK_SIZE;
    const startRow = this.coordinates.z * Chunk.CHUNK_SIZE;

    let instanceIndex = 0;
    for (let col = startCol; col < startCol + Chunk.CHUNK_SIZE; col++) {
      for (let row = startRow; row < startRow + Chunk.CHUNK_SIZE; row++) {
        const hexKey = `${col},${row}`;

        // Create hexagon data object (lightweight, no mesh)
        const hexagon = new Hexagon(col, row, instanceIndex);
        this.hexagons.set(hexKey, hexagon);

        // Set instance matrix using reusable objects
        const worldPos = getWorldPositionForHex({ col, row });
        Chunk._tempPosition.set(worldPos.x, Hexagon.HEX_HEIGHT, worldPos.z);
        Chunk._tempQuaternion.setFromAxisAngle(Chunk._tempAxisX, -Math.PI / 2);

        Chunk._tempMatrix.compose(Chunk._tempPosition, Chunk._tempQuaternion, Chunk._tempScale);
        this.instancedMesh.setMatrixAt(instanceIndex, Chunk._tempMatrix);

        instanceIndex++;
      }
    }

    // Update the instance matrix
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.instancedMesh);

    this.isLoaded = true;
  }

  public unload(): void {
    if (!this.isLoaded) return;

    // Remove instanced mesh from group
    if (this.instancedMesh) {
      this.group.remove(this.instancedMesh);
      // Don't dispose geometry/material as they're shared
      this.instancedMesh = null;
    }

    // Clear hexagon data (lightweight objects)
    this.hexagons.forEach((hexagon) => {
      hexagon.dispose();
    });

    this.hexagons.clear();
    this.isLoaded = false;
  }

  public async getGroup(): Promise<THREE.Group> {
    return this.group;
  }

  public getCoordinates(): ChunkCoordinates {
    return this.coordinates;
  }

  public isChunkLoaded(): boolean {
    return this.isLoaded;
  }

  public getHexagonAt(col: number, row: number): Hexagon | undefined {
    const hexKey = `${col},${row}`;
    return this.hexagons.get(hexKey);
  }

  public getAllHexagons(): Hexagon[] {
    return Array.from(this.hexagons.values());
  }

  public getBounds(): { minCol: number; maxCol: number; minRow: number; maxRow: number } {
    const startCol = this.coordinates.x * Chunk.CHUNK_SIZE;
    const startRow = this.coordinates.z * Chunk.CHUNK_SIZE;

    return {
      minCol: startCol,
      maxCol: startCol + Chunk.CHUNK_SIZE - 1,
      minRow: startRow,
      maxRow: startRow + Chunk.CHUNK_SIZE - 1,
    };
  }

  public getInstancedMesh(): THREE.InstancedMesh | null {
    return this.instancedMesh;
  }

  public handleHexagonClick(instanceId: number): void {
    const hexagon = Array.from(this.hexagons.values()).find((h) => h.getInstanceId() === instanceId);
    if (hexagon) {
      hexagon.onClick();
      // Update the specific instance color for visual feedback
      this.updateInstanceColor(instanceId, Chunk.CLICK_COLOR);

      setTimeout(() => {
        this.updateInstanceColor(instanceId, Chunk.DEFAULT_COLOR);
      }, 200);
    }
  }

  private updateInstanceColor(instanceId: number, color: number): void {
    if (!this.instancedMesh || !this.instancedMesh.instanceColor) return;

    // Convert hex color to RGB components (0-1 range)
    const r = ((color >> 16) & 255) / 255;
    const g = ((color >> 8) & 255) / 255;
    const b = (color & 255) / 255;

    // Update the specific instance color
    const colors = this.instancedMesh.instanceColor.array as Float32Array;
    colors[instanceId * 3] = r;
    colors[instanceId * 3 + 1] = g;
    colors[instanceId * 3 + 2] = b;

    // Mark the attribute as needing update
    this.instancedMesh.instanceColor.needsUpdate = true;
  }

  public dispose(): void {
    this.unload();
  }

  public static getChunkCoordinatesFromHex(col: number, row: number): ChunkCoordinates {
    return {
      x: Math.floor(col / Chunk.CHUNK_SIZE),
      z: Math.floor(row / Chunk.CHUNK_SIZE),
    };
  }

  public static getChunkKey(chunkX: number, chunkZ: number): string {
    return `${chunkX},${chunkZ}`;
  }
}
