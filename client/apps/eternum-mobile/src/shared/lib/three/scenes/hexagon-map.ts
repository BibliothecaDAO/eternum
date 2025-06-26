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
  private static readonly CHUNK_LOAD_RADIUS_X = 2; // Load chunks within this radius horizontally
  private static readonly CHUNK_LOAD_RADIUS_Z = 2; // Load chunks within this radius vertically
  private static readonly CHUNK_SIZE = 5; // 5x5 hexagons per chunk

  // Dynamic chunk loading radius (can be adjusted based on screen size)
  private chunkLoadRadiusX = HexagonMap.CHUNK_LOAD_RADIUS_X;
  private chunkLoadRadiusZ = HexagonMap.CHUNK_LOAD_RADIUS_Z;

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

    const radiusX = this.chunkLoadRadiusX;
    const radiusZ = this.chunkLoadRadiusZ;
    console.log(
      `\n=== Updating visible hexes for center chunk (${centerChunkX}, ${centerChunkZ}) with radius (${radiusX}, ${radiusZ}) ===`,
    );

    for (let x = centerChunkX - radiusX; x <= centerChunkX + radiusX; x++) {
      for (let z = centerChunkZ - radiusZ; z <= centerChunkZ + radiusZ; z++) {
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
    // Convert camera position to hex coordinates using the same logic as getHexForWorldPosition
    const hexRadius = HEX_SIZE;
    const hexHeight = hexRadius * 2;
    const hexWidth = hexHeight * 1.6; // width = height * 1.6
    const vertDist = hexHeight * 0.75; // Vertical distance between row centers
    const horizDist = hexWidth; // Horizontal distance between column centers

    // Calculate row first
    const row = Math.round(cameraPosition.z / vertDist);
    // Calculate row offset for hexagon staggering
    const rowOffset = ((row % 2) * Math.sign(row) * horizDist) / 2;
    // Calculate column using the offset
    const col = Math.round((cameraPosition.x + rowOffset) / horizDist);

    // Get chunk coordinates
    const chunkX = Math.floor(col / HexagonMap.CHUNK_SIZE);
    const chunkZ = Math.floor(row / HexagonMap.CHUNK_SIZE);

    // Only update if we've moved to a different chunk
    if (chunkX !== this.lastChunkX || chunkZ !== this.lastChunkZ) {
      console.log(`Moving from chunk (${this.lastChunkX}, ${this.lastChunkZ}) to chunk (${chunkX}, ${chunkZ})`);
      console.log(`Camera at (${cameraPosition.x.toFixed(2)}, ${cameraPosition.z.toFixed(2)}) -> Hex (${col}, ${row})`);
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

  /**
   * Adjust chunk loading radius based on screen dimensions and camera settings
   * @param screenWidth - Screen width in pixels
   * @param screenHeight - Screen height in pixels
   * @param cameraDistance - Distance of camera from the map
   */
  public adjustChunkLoadingRadius(screenWidth: number, screenHeight: number, cameraDistance: number = 10): void {
    // Calculate aspect ratio
    const aspectRatio = screenWidth / screenHeight;

    // Base radius calculation - adjust these multipliers as needed
    const baseRadius = Math.max(1, Math.ceil(cameraDistance / 10));

    if (aspectRatio > 1) {
      // Landscape orientation - load more chunks horizontally
      this.chunkLoadRadiusX = Math.ceil(baseRadius * aspectRatio);
      this.chunkLoadRadiusZ = baseRadius;
    } else {
      // Portrait orientation - load more chunks vertically
      this.chunkLoadRadiusX = baseRadius;
      this.chunkLoadRadiusZ = Math.ceil(baseRadius / aspectRatio);
    }

    console.log(
      `Adjusted chunk loading radius to (${this.chunkLoadRadiusX}, ${this.chunkLoadRadiusZ}) for screen ${screenWidth}x${screenHeight}, aspect ratio: ${aspectRatio.toFixed(2)}`,
    );
  }
}
