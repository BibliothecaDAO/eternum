import * as THREE from "three";
import { Hexagon } from "./hexagon";

export interface ChunkCoordinates {
  x: number;
  z: number;
}

export class Chunk {
  private coordinates: ChunkCoordinates;
  private hexagons: Map<string, Hexagon>;
  private group: THREE.Group;
  private isLoaded: boolean;

  // Chunk constants
  public static readonly CHUNK_SIZE = 5; // 5x5 hexagons per chunk

  constructor(chunkX: number, chunkZ: number) {
    this.coordinates = { x: chunkX, z: chunkZ };
    this.hexagons = new Map();
    this.group = new THREE.Group();
    this.isLoaded = false;

    this.group.userData = { chunk: this, coordinates: this.coordinates };
  }

  public load(): void {
    if (this.isLoaded) return;

    // Calculate hexagon coordinates for this chunk
    const startCol = this.coordinates.x * Chunk.CHUNK_SIZE;
    const startRow = this.coordinates.z * Chunk.CHUNK_SIZE;

    for (let col = startCol; col < startCol + Chunk.CHUNK_SIZE; col++) {
      for (let row = startRow; row < startRow + Chunk.CHUNK_SIZE; row++) {
        const hexKey = `${col},${row}`;
        const hexagon = new Hexagon(col, row);

        this.hexagons.set(hexKey, hexagon);
        this.group.add(hexagon.getMesh());
      }
    }

    this.isLoaded = true;
  }

  public unload(): void {
    if (!this.isLoaded) return;

    // Remove all hexagons from the group
    this.hexagons.forEach((hexagon) => {
      this.group.remove(hexagon.getMesh());
      hexagon.dispose();
    });

    this.hexagons.clear();
    this.isLoaded = false;
  }

  public getGroup(): THREE.Group {
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
