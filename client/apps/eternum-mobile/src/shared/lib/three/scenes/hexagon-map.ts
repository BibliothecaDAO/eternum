import * as THREE from "three";
import { createHexagonShape } from "./hexagon-geometry";
import { TilePosition, TileRenderer } from "./tile-renderer";
import { getHexagonCoordinates, getWorldPositionForHex, HEX_SIZE } from "./utils";

export class HexagonMap {
  private scene: THREE.Scene;
  private allHexes: Set<string> = new Set();
  private visibleHexes: Set<string> = new Set();
  private instanceMesh: THREE.InstancedMesh | null = null;
  private tileRenderer: TileRenderer;
  private raycaster: THREE.Raycaster;
  private matrix = new THREE.Matrix4();
  private position = new THREE.Vector3();
  private dummy = new THREE.Object3D();

  // Chunk loading optimization
  private lastChunkX: number = -999;
  private lastChunkZ: number = -999;

  // Map constants - removed MAP_SIZE since map is infinite
  private static readonly CHUNK_LOAD_RADIUS = 1; // Load chunks within this radius
  private static readonly CHUNK_SIZE = 5; // 5x5 hexagons per chunk

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.raycaster = new THREE.Raycaster();
    this.tileRenderer = new TileRenderer(scene);
    this.initializeMap();
  }

  private initializeMap(): void {
    // No need to pre-populate allHexes since map is infinite
    // Hexes will be generated dynamically as chunks are loaded

    // Load initial chunks (start at center 0,0)
    const centerChunkX = 0;
    const centerChunkZ = 0;

    // Set initial chunk position
    this.lastChunkX = centerChunkX;
    this.lastChunkZ = centerChunkZ;

    this.updateVisibleHexes(centerChunkX, centerChunkZ);
  }

  // Add hex to the global collection of all hexagons (now dynamic)
  private addHex(hex: { col: number; row: number }): void {
    const key = `${hex.col},${hex.row}`;
    this.allHexes.add(key);
  }

  // Filter visible hexes for the current chunk area
  private updateVisibleHexes(centerChunkX: number, centerChunkZ: number): void {
    this.visibleHexes.clear();

    const radius = HexagonMap.CHUNK_LOAD_RADIUS;
    console.log(
      `\n=== Updating visible hexes for center chunk (${centerChunkX}, ${centerChunkZ}) with radius ${radius} ===`,
    );

    for (let x = centerChunkX - radius; x <= centerChunkX + radius; x++) {
      for (let z = centerChunkZ - radius; z <= centerChunkZ + radius; z++) {
        // Check if chunk is within map bounds
        if (this.isChunkInBounds(x, z)) {
          console.log(`Processing chunk (${x}, ${z})`);
          this.loadChunkHexes(x, z);
        } else {
          console.log(`Skipping chunk (${x}, ${z}) - out of bounds`);
        }
      }
    }

    // Log summary of loaded hexes
    if (this.visibleHexes.size > 0) {
      const hexArray = Array.from(this.visibleHexes).map((hexString) => {
        const [col, row] = hexString.split(",").map(Number);
        return { col, row };
      });

      const minCol = Math.min(...hexArray.map((h) => h.col));
      const maxCol = Math.max(...hexArray.map((h) => h.col));
      const minRow = Math.min(...hexArray.map((h) => h.row));
      const maxRow = Math.max(...hexArray.map((h) => h.row));

      console.log(
        `Total visible hexes: ${this.visibleHexes.size}, range: cols ${minCol}-${maxCol}, rows ${minRow}-${maxRow}`,
      );
    } else {
      console.log("No visible hexes loaded");
    }
    console.log("=== End update ===\n");

    // Render only the visible hexes
    this.renderHexes();
  }

  private isChunkInBounds(chunkX: number, chunkZ: number): boolean {
    // For infinite map, all chunks are always in bounds
    return true;
  }

  private loadChunkHexes(chunkX: number, chunkZ: number): void {
    // Calculate chunk boundaries
    const startCol = chunkX * HexagonMap.CHUNK_SIZE;
    const startRow = chunkZ * HexagonMap.CHUNK_SIZE;
    const endCol = startCol + HexagonMap.CHUNK_SIZE;
    const endRow = startRow + HexagonMap.CHUNK_SIZE;

    // For infinite map, no clamping needed - generate hexes dynamically
    for (let col = startCol; col < endCol; col++) {
      for (let row = startRow; row < endRow; row++) {
        const hexKey = `${col},${row}`;
        // Add hex to allHexes if it doesn't exist (dynamic generation)
        this.allHexes.add(hexKey);
        // Add to visible hexes
        this.visibleHexes.add(hexKey);
      }
    }

    // Debug logging to help understand what's being loaded
    console.log(
      `Loading chunk (${chunkX}, ${chunkZ}): hex range (${startCol}-${endCol - 1}, ${startRow}-${endRow - 1})`,
    );
  }

  private renderHexes(): void {
    if (this.instanceMesh) {
      this.scene.remove(this.instanceMesh);
      this.instanceMesh.dispose();
    }

    const hexagonShape = createHexagonShape(HEX_SIZE); // 0.98 scale for gaps
    const hexagonGeometry = new THREE.ShapeGeometry(hexagonShape);
    const hexagonMaterial = new THREE.MeshLambertMaterial({
      color: 0xffffff, // White base color, will be overridden by instance colors
      transparent: true,
      opacity: 0.5,
    });

    const instanceCount = this.visibleHexes.size;

    if (instanceCount === 0) {
      // Clear tiles when no hexes are visible
      this.tileRenderer.clearTiles();
      return;
    }

    this.instanceMesh = new THREE.InstancedMesh(hexagonGeometry, hexagonMaterial, instanceCount);

    // Set up per-instance colors
    this.instanceMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(instanceCount * 3), 3);

    // Collect and sort hexes by row for proper rendering order
    const hexArray = Array.from(this.visibleHexes).map((hexString) => {
      const [col, row] = hexString.split(",").map(Number);
      return { col, row, hexString };
    });

    // Sort by row (higher row = higher render order)
    hexArray.sort((a, b) => b.row - a.row);

    let index = 0;
    const tilePositions: TilePosition[] = [];

    hexArray.forEach(({ col, row, hexString }) => {
      const position = getWorldPositionForHex({ col, row });

      // Position hex shape
      this.dummy.position.set(position.x, 0.1, position.z);
      this.dummy.rotation.x = -Math.PI / 2;
      this.dummy.updateMatrix();
      this.instanceMesh!.setMatrixAt(index, this.dummy.matrix);

      // Set default blue color for each instance
      this.instanceMesh!.setColorAt(index, new THREE.Color(0x4a90e2));

      // Collect tile positions for the tile renderer
      //tilePositions.push({ col, row });

      index++;
    });

    // Update instance colors
    if (this.instanceMesh!.instanceColor) {
      this.instanceMesh!.instanceColor.needsUpdate = true;
    }

    this.scene.add(this.instanceMesh);

    // Render tiles using the TileRenderer
    this.tileRenderer.renderTilesForHexes(tilePositions);
  }

  public updateChunkLoading(cameraPosition: THREE.Vector3): void {
    // Convert camera position to hex coordinates
    const hexCol = Math.floor(cameraPosition.x / (HEX_SIZE * Math.sqrt(3)));
    const hexRow = Math.floor(cameraPosition.z / (HEX_SIZE * 1.5));

    // Get chunk coordinates
    const chunkX = Math.floor(hexCol / HexagonMap.CHUNK_SIZE);
    const chunkZ = Math.floor(hexRow / HexagonMap.CHUNK_SIZE);

    // Only update if we've moved to a different chunk
    if (chunkX !== this.lastChunkX || chunkZ !== this.lastChunkZ) {
      console.log(`Moving from chunk (${this.lastChunkX}, ${this.lastChunkZ}) to chunk (${chunkX}, ${chunkZ})`);
      this.updateVisibleHexes(chunkX, chunkZ);
      this.lastChunkX = chunkX;
      this.lastChunkZ = chunkZ;
    }
  }

  public handleClick(mouse: THREE.Vector2, camera: THREE.Camera): void {
    if (!this.instanceMesh) return;

    // Update raycaster
    this.raycaster.setFromCamera(mouse, camera);

    // Check for intersections
    const intersects = this.raycaster.intersectObjects([this.instanceMesh], true);

    if (intersects.length > 0) {
      const intersect = intersects[0];
      const intersectedObject = intersect.object;

      if (intersectedObject instanceof THREE.InstancedMesh) {
        const instanceId = intersect.instanceId;
        if (instanceId !== undefined) {
          const hexData = getHexagonCoordinates(intersectedObject, instanceId);
          console.log(`Hexagon clicked: col=${hexData.hexCoords.col}, row=${hexData.hexCoords.row}`);

          // Visual feedback - temporarily change color of the instance
          this.showClickFeedback(instanceId);
        }
      }
    }
  }

  private showClickFeedback(instanceId: number): void {
    if (!this.instanceMesh) return;

    // Change color of only the clicked instance
    const originalColor = new THREE.Color();
    this.instanceMesh.getColorAt(instanceId, originalColor);

    // Set clicked instance to red
    this.instanceMesh.setColorAt(instanceId, new THREE.Color(0xff6b6b));
    this.instanceMesh.instanceColor!.needsUpdate = true;

    // Restore original color after 200ms
    setTimeout(() => {
      if (this.instanceMesh) {
        this.instanceMesh.setColorAt(instanceId, originalColor);
        this.instanceMesh.instanceColor!.needsUpdate = true;
      }
    }, 200);
  }

  public getMapBounds(): { minCol: number; maxCol: number; minRow: number; maxRow: number } {
    // For infinite map, return current visible bounds
    if (this.visibleHexes.size === 0) {
      return { minCol: 0, maxCol: 0, minRow: 0, maxRow: 0 };
    }

    const hexArray = Array.from(this.visibleHexes).map((hexString) => {
      const [col, row] = hexString.split(",").map(Number);
      return { col, row };
    });

    const minCol = Math.min(...hexArray.map((h) => h.col));
    const maxCol = Math.max(...hexArray.map((h) => h.col));
    const minRow = Math.min(...hexArray.map((h) => h.row));
    const maxRow = Math.max(...hexArray.map((h) => h.row));

    return { minCol, maxCol, minRow, maxRow };
  }

  // Debug helper method to test chunk calculations
  public debugChunkCalculations(chunkX: number, chunkZ: number): void {
    console.log(`\n=== DEBUG: Chunk (${chunkX}, ${chunkZ}) calculations ===`);

    // Test if chunk is in bounds
    const inBounds = this.isChunkInBounds(chunkX, chunkZ);
    console.log(`Chunk in bounds: ${inBounds}`);

    if (inBounds) {
      // Calculate what hexes would be loaded
      const startCol = chunkX * HexagonMap.CHUNK_SIZE;
      const startRow = chunkZ * HexagonMap.CHUNK_SIZE;
      const endCol = startCol + HexagonMap.CHUNK_SIZE;
      const endRow = startRow + HexagonMap.CHUNK_SIZE;

      console.log(`Chunk bounds: cols ${startCol}-${endCol - 1}, rows ${startRow}-${endRow - 1}`);
      console.log(`Would load ${HexagonMap.CHUNK_SIZE * HexagonMap.CHUNK_SIZE} hexes`);
    }

    console.log("=== END DEBUG ===\n");
  }

  public dispose(): void {
    if (this.instanceMesh) {
      this.scene.remove(this.instanceMesh);
      this.instanceMesh.dispose();
    }

    // Dispose tile renderer
    this.tileRenderer.dispose();

    this.allHexes.clear();
    this.visibleHexes.clear();
  }
}
