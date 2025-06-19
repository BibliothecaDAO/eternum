import * as THREE from "three";
import { createHexagonShape } from "./hexagon-geometry";
import { getHexagonCoordinates, getWorldPositionForHex, HEX_SIZE } from "./utils";

export class HexagonMap {
  private scene: THREE.Scene;
  private allHexes: Set<string> = new Set();
  private visibleHexes: Set<string> = new Set();
  private instanceMesh: THREE.InstancedMesh | null = null;
  private raycaster: THREE.Raycaster;
  private matrix = new THREE.Matrix4();
  private position = new THREE.Vector3();
  private dummy = new THREE.Object3D();

  // Chunk loading optimization
  private lastChunkX: number = -999;
  private lastChunkZ: number = -999;

  // Map constants
  private static readonly MAP_SIZE = 20; // 20x20 hexagons total
  private static readonly CHUNK_LOAD_RADIUS = 1; // Load chunks within this radius
  private static readonly CHUNK_SIZE = 5; // 5x5 hexagons per chunk

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.raycaster = new THREE.Raycaster();
    this.initializeMap();
  }

  private initializeMap(): void {
    // Add all hexagons to the collection
    for (let col = 0; col < HexagonMap.MAP_SIZE; col++) {
      for (let row = 0; row < HexagonMap.MAP_SIZE; row++) {
        this.addHex({ col, row });
      }
    }

    // Load initial chunks (center area)
    const centerChunkX = Math.floor(HexagonMap.MAP_SIZE / 2 / HexagonMap.CHUNK_SIZE);
    const centerChunkZ = Math.floor(HexagonMap.MAP_SIZE / 2 / HexagonMap.CHUNK_SIZE);

    // Set initial chunk position
    this.lastChunkX = centerChunkX;
    this.lastChunkZ = centerChunkZ;

    this.updateVisibleHexes(centerChunkX, centerChunkZ);
  }

  // Add hex to the global collection of all hexagons
  private addHex(hex: { col: number; row: number }): void {
    const key = `${hex.col},${hex.row}`;
    this.allHexes.add(key);
  }

  // Filter visible hexes for the current chunk area
  private updateVisibleHexes(centerChunkX: number, centerChunkZ: number): void {
    this.visibleHexes.clear();

    const radius = HexagonMap.CHUNK_LOAD_RADIUS;

    for (let x = centerChunkX - radius; x <= centerChunkX + radius; x++) {
      for (let z = centerChunkZ - radius; z <= centerChunkZ + radius; z++) {
        // Check if chunk is within map bounds
        if (this.isChunkInBounds(x, z)) {
          this.loadChunkHexes(x, z);
        }
      }
    }

    // Render only the visible hexes
    this.renderHexes();
  }

  private isChunkInBounds(chunkX: number, chunkZ: number): boolean {
    const maxChunks = Math.ceil(HexagonMap.MAP_SIZE / HexagonMap.CHUNK_SIZE);
    return chunkX >= 0 && chunkX < maxChunks && chunkZ >= 0 && chunkZ < maxChunks;
  }

  private loadChunkHexes(chunkX: number, chunkZ: number): void {
    // Calculate chunk boundaries
    const startCol = chunkX * HexagonMap.CHUNK_SIZE;
    const startRow = chunkZ * HexagonMap.CHUNK_SIZE;
    const endCol = Math.min(startCol + HexagonMap.CHUNK_SIZE, HexagonMap.MAP_SIZE);
    const endRow = Math.min(startRow + HexagonMap.CHUNK_SIZE, HexagonMap.MAP_SIZE);

    // Add hexes within chunk bounds to visible set
    for (let col = startCol; col < endCol; col++) {
      for (let row = startRow; row < endRow; row++) {
        const hexKey = `${col},${row}`;
        if (this.allHexes.has(hexKey)) {
          this.visibleHexes.add(hexKey);
        }
      }
    }
  }

  private renderHexes(): void {
    if (this.instanceMesh) {
      this.scene.remove(this.instanceMesh);
      this.instanceMesh.dispose();
    }

    const hexagonShape = createHexagonShape(HEX_SIZE * 0.98); // 0.9 scale for gaps
    const hexagonGeometry = new THREE.ShapeGeometry(hexagonShape);
    const hexagonMaterial = new THREE.MeshLambertMaterial({
      color: 0xffffff, // White base color, will be overridden by instance colors
      transparent: true,
      opacity: 0.8,
    });

    const instanceCount = this.visibleHexes.size;

    if (instanceCount === 0) return;

    this.instanceMesh = new THREE.InstancedMesh(hexagonGeometry, hexagonMaterial, instanceCount);

    // Set up per-instance colors
    this.instanceMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(instanceCount * 3), 3);

    let index = 0;
    this.visibleHexes.forEach((hexString) => {
      const [col, row] = hexString.split(",").map(Number);
      const position = getWorldPositionForHex({ col, row });

      // Simple positioning without random offsets
      this.dummy.position.set(position.x, 0.1, position.z);
      this.dummy.rotation.x = -Math.PI / 2;
      this.dummy.updateMatrix();
      this.instanceMesh!.setMatrixAt(index, this.dummy.matrix);

      // Set default blue color for each instance
      this.instanceMesh!.setColorAt(index, new THREE.Color(0x4a90e2));

      index++;
    });

    // Update instance colors
    if (this.instanceMesh!.instanceColor) {
      this.instanceMesh!.instanceColor.needsUpdate = true;
    }

    this.scene.add(this.instanceMesh);
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
    return {
      minCol: 0,
      maxCol: HexagonMap.MAP_SIZE - 1,
      minRow: 0,
      maxRow: HexagonMap.MAP_SIZE - 1,
    };
  }

  public dispose(): void {
    if (this.instanceMesh) {
      this.scene.remove(this.instanceMesh);
      this.instanceMesh.dispose();
    }

    this.allHexes.clear();
    this.visibleHexes.clear();
  }
}
