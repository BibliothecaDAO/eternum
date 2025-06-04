import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { sqlApi } from "@/services/api";
import { BIOME_COLORS } from "@/three/managers/biome-colors";
import type WorldmapScene from "@/three/scenes/worldmap";
import { Position } from "@/types/position";
import { BiomeIdToType, HexPosition, ResourcesIds, StructureType, Tile, TileOccupier } from "@bibliothecadao/types";
import throttle from "lodash/throttle";
import type * as THREE from "three";
import { CameraView } from "../scenes/hexagon-scene";
import { getExplorerInfoFromTileOccupier, getStructureInfoFromTileOccupier } from "../systems/system-manager";
import { getHexForWorldPosition } from "../utils";

const LABELS = {
  ARMY: "/images/labels/enemy_army.png",
  MY_ARMY: "/images/labels/army.png",
  MY_REALM: "/images/labels/realm.png",
  MY_REALM_WONDER: "/images/labels/realm.png",
  REALM_WONDER: "/images/labels/realm.png",
  STRUCTURES: {
    [StructureType.Village]: "/images/labels/enemy_village.png",
    [StructureType.Realm]: "/images/labels/enemy_realm.png",
    [StructureType.Hyperstructure]: "/images/labels/hyperstructure.png",
    [StructureType.Bank]: `images/resources/${ResourcesIds.Lords}.png`,
    [StructureType.FragmentMine]: "/images/labels/fragment_mine.png",
  },
  MY_STRUCTURES: {
    [StructureType.Village]: "/images/labels/village.png",
    [StructureType.Realm]: "/images/labels/realm.png",
  },
  QUEST: "/images/labels/quest.png",
};

const MINIMAP_CONFIG = {
  MIN_ZOOM_RANGE: 75,
  MAX_ZOOM_RANGE: 900,
  MAP_COLS_WIDTH: 200,
  MAP_ROWS_HEIGHT: 100,
  EXPANDED_MODIFIER: 0.5,
  COLORS: {
    ARMY: "#FF0000",
    MY_ARMY: "#00FF00",
    CAMERA: "#FFFFFF",
    STRUCTURES: {
      [StructureType.Realm]: "#0000ff",
      [StructureType.Hyperstructure]: "#FFFFFF",
      [StructureType.Bank]: "#FFFF00",
      [StructureType.FragmentMine]: "#00FFFF",
    },
    QUEST: "#0000FF",
  },
  SIZES: {
    STRUCTURE: 14,
    ARMY: 14,
    CAMERA: {
      TOP_SIDE_WIDTH_FACTOR: 105,
      BOTTOM_SIDE_WIDTH_FACTOR: 170,
      HEIGHT_FACTOR: 13,
    },
  },
  BORDER_WIDTH_PERCENT: 0.1,
  // Clustering configuration
  CLUSTER: {
    MIN_RADIUS: 1, // Minimum radius when fully zoomed in
    MAX_RADIUS: 8, // Maximum radius when fully zoomed out
  },
};

// Generic cluster interface for any entity type
interface EntityCluster {
  centerCol: number;
  centerRow: number;
  entities: {
    col: number;
    row: number;
    isMine: boolean;
    type?: StructureType; // Only for structures
  }[];
  isMine: boolean;
  type?: StructureType; // Only for structures
}

// Keep ArmyCluster for backward compatibility
interface ArmyCluster extends EntityCluster {}

class Minimap {
  private worldmapScene: WorldmapScene;
  private canvas!: HTMLCanvasElement;
  private context!: CanvasRenderingContext2D;
  private camera!: THREE.PerspectiveCamera;
  private mapCenter: { col: number; row: number } = { col: 250, row: 150 };
  private mapSize: { width: number; height: number } = {
    width: MINIMAP_CONFIG.MAP_COLS_WIDTH,
    height: MINIMAP_CONFIG.MAP_ROWS_HEIGHT,
  };
  private scaleX!: number;
  private scaleY!: number;
  private dragSpeed: number = 1;
  private isDragging: boolean = false;
  private biomeCache!: Map<string, string>;
  private scaledCoords!: Map<string, { scaledCol: number; scaledRow: number }>;
  private BORDER_WIDTH_PERCENT = MINIMAP_CONFIG.BORDER_WIDTH_PERCENT;
  private structureSize!: { width: number; height: number };
  private armySize!: { width: number; height: number };
  private questSize!: { width: number; height: number };
  private cameraSize!: {
    topSideWidth: number;
    bottomSideWidth: number;
    height: number;
  };
  private labelImages = new Map<string, HTMLImageElement>();
  private lastMousePosition: { x: number; y: number } | null = null;
  private mouseStartPosition: { x: number; y: number } | null = null;
  private tiles: Tile[] = []; // SQL-fetched tiles
  private hoveredHexCoords: { col: number; row: number } | null = null; // New property for tracking hovered hex

  // Entity visibility toggles
  private showRealms: boolean = true;
  private showArmies: boolean = true;
  private showHyperstructures: boolean = true;
  private showBanks: boolean = true;
  private showFragmentMines: boolean = true;
  private showQuests: boolean = true;

  // Clustering properties
  private armyClusters: EntityCluster[] = [];
  private structureClusters: Map<StructureType, EntityCluster[]> = new Map();
  private currentClusterRadius: number = MINIMAP_CONFIG.CLUSTER.MIN_RADIUS;
  private needsReclustering: boolean = true;
  private lastZoomRatio: number = 0;

  constructor(worldmapScene: WorldmapScene, camera: THREE.PerspectiveCamera) {
    this.worldmapScene = worldmapScene;

    // Expose the minimap instance globally for UI access
    (window as any).minimapInstance = this;

    this.waitForMinimapElement().then((canvas) => {
      this.canvas = canvas;
      this.loadLabelImages();
      this.initializeCanvas(camera);
      this.canvas.addEventListener("canvasResized", this.handleResize);
      this.fetchTiles(); // Start fetching tiles
    });
  }

  private async waitForMinimapElement(): Promise<HTMLCanvasElement> {
    return new Promise((resolve) => {
      const checkElement = () => {
        const element = document.getElementById("minimap") as HTMLCanvasElement;
        if (element) {
          resolve(element);
        } else {
          requestAnimationFrame(checkElement);
        }
      };
      checkElement();
    });
  }

  private initializeCanvas(camera: THREE.PerspectiveCamera) {
    this.context = this.canvas.getContext("2d")!;
    this.camera = camera;
    this.scaleX = this.canvas.width / this.mapSize.width;
    this.scaleY = this.canvas.height / this.mapSize.height;
    this.biomeCache = new Map();
    this.scaledCoords = new Map();
    this.structureSize = { width: 0, height: 0 };
    this.armySize = { width: 0, height: 0 };
    this.questSize = { width: 0, height: 0 };
    this.cameraSize = { topSideWidth: 0, bottomSideWidth: 0, height: 0 };
    this.recomputeScales();

    this.draw = throttle(this.draw, 1000 / 30);

    this.canvas.addEventListener("mousedown", this.handleMouseDown);
    this.canvas.addEventListener("mousemove", this.handleMouseMove);
    this.canvas.addEventListener("mouseup", this.handleMouseUp);
    this.canvas.addEventListener("wheel", this.handleWheel);
    this.canvas.addEventListener("mouseleave", this.handleMouseLeave); // Add listener for mouse leave
  }

  private recomputeScales() {
    if (!this.canvas || !this.mapSize) return;
    this.scaleX = this.canvas.width / this.mapSize.width;
    this.scaleY = this.canvas.height / this.mapSize.height;
    this.scaledCoords.clear();
    const minCol = this.mapCenter.col - this.mapSize.width / 2;
    const maxCol = this.mapCenter.col + this.mapSize.width / 2;
    const minRow = this.mapCenter.row - this.mapSize.height / 2;
    const maxRow = this.mapCenter.row + this.mapSize.height / 2;

    for (let col = minCol; col <= maxCol; col++) {
      for (let row = minRow; row <= maxRow; row++) {
        const scaledCol = (col - minCol) * this.scaleX;
        const scaledRow = (row - minRow) * this.scaleY;
        this.scaledCoords.set(`${col},${row}`, { scaledCol, scaledRow });
      }
    }

    this.dragSpeed = this.mapSize.width / MINIMAP_CONFIG.MAX_ZOOM_RANGE;
    let modifier = 1;
    if (this.canvas.width > 300) {
      modifier = MINIMAP_CONFIG.EXPANDED_MODIFIER;
    }

    // Add zoom-based scaling for icons
    // As we get closer to MIN_ZOOM_RANGE, we want icons to get smaller
    const zoomRatio = Math.min(
      1,
      (this.mapSize.width - MINIMAP_CONFIG.MIN_ZOOM_RANGE) /
        (MINIMAP_CONFIG.MAX_ZOOM_RANGE - MINIMAP_CONFIG.MIN_ZOOM_RANGE),
    );

    // Scale from 0.5 (at max zoom) to 2.0 (at min zoom)
    // This will make icons twice as large when zoomed out while keeping them at current size when zoomed in
    let zoomScaleFactor = 1;
    if (this.canvas.width > 400) {
      zoomScaleFactor = 0.25 + zoomRatio * 0.5;
    } else {
      zoomScaleFactor = 0.5 + zoomRatio * 1.5;
    }

    // Precompute sizes with zoom scaling
    this.structureSize = {
      width: MINIMAP_CONFIG.SIZES.STRUCTURE * this.scaleX * modifier * zoomScaleFactor,
      height: MINIMAP_CONFIG.SIZES.STRUCTURE * this.scaleX * modifier * zoomScaleFactor,
    };
    this.armySize = {
      width: MINIMAP_CONFIG.SIZES.ARMY * this.scaleX * modifier * zoomScaleFactor,
      height: MINIMAP_CONFIG.SIZES.ARMY * this.scaleX * modifier * zoomScaleFactor,
    };
    this.questSize = {
      width: MINIMAP_CONFIG.SIZES.ARMY * this.scaleX * modifier * zoomScaleFactor,
      height: MINIMAP_CONFIG.SIZES.ARMY * this.scaleX * modifier * zoomScaleFactor,
    };
    this.cameraSize = {
      topSideWidth: (window.innerWidth / MINIMAP_CONFIG.SIZES.CAMERA.TOP_SIDE_WIDTH_FACTOR) * this.scaleX,
      bottomSideWidth: (window.innerWidth / MINIMAP_CONFIG.SIZES.CAMERA.BOTTOM_SIDE_WIDTH_FACTOR) * this.scaleX,
      height: MINIMAP_CONFIG.SIZES.CAMERA.HEIGHT_FACTOR * this.scaleY,
    };

    // Adjust clustering radius based on zoom level and check if reclustering is needed
    const newRadius = Math.max(
      MINIMAP_CONFIG.CLUSTER.MIN_RADIUS,
      Math.min(
        MINIMAP_CONFIG.CLUSTER.MAX_RADIUS,
        Math.round(
          MINIMAP_CONFIG.CLUSTER.MIN_RADIUS +
            zoomRatio * (MINIMAP_CONFIG.CLUSTER.MAX_RADIUS - MINIMAP_CONFIG.CLUSTER.MIN_RADIUS),
        ),
      ),
    );

    // Only trigger reclustering if the zoom level changed significantly
    if (newRadius !== this.currentClusterRadius || Math.abs(zoomRatio - this.lastZoomRatio) > 0.1) {
      this.currentClusterRadius = newRadius;
      this.lastZoomRatio = zoomRatio;
      this.needsReclustering = true;
    }
  }

  private getMousePosition(event: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const col = Math.floor(x / this.scaleX) + (this.mapCenter.col - this.mapSize.width / 2);
    const row = Math.floor(y / this.scaleY) + (this.mapCenter.row - this.mapSize.height / 2);
    return { col, row, x, y };
  }

  draw() {
    if (!this.context) return;

    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawExploredTiles();
    this.drawStructures();
    this.drawArmies();
    this.drawQuests();
    this.drawCamera();
    this.drawHoveredCoordinates(); // Add this new method call
  }

  private drawExploredTiles() {
    if (!this.context) return;

    // Draw SQL-fetched tiles first
    this.tiles.forEach((tile) => {
      const cacheKey = `${tile.col},${tile.row}`;
      let biomeColor;

      if (this.biomeCache.has(cacheKey)) {
        biomeColor = this.biomeCache.get(cacheKey)!;
      } else {
        const biomeType = BiomeIdToType[tile.biome];
        biomeColor = BIOME_COLORS[biomeType].getStyle();
        this.biomeCache.set(cacheKey, biomeColor);
      }

      if (this.scaledCoords.has(cacheKey)) {
        const { scaledCol, scaledRow } = this.scaledCoords.get(cacheKey)!;
        this.context.fillStyle = biomeColor;
        this.context.fillRect(
          scaledCol - this.scaleX * (tile.row % 2 !== 0 ? 1 : 0.5),
          scaledRow - this.scaleY / 2,
          this.scaleX,
          this.scaleY,
        );
      }
    });
  }

  private drawStructures() {
    if (!this.context) return;

    // Recalculate clusters only when needed
    if (this.needsReclustering) {
      this.clusterStructures();
    }

    // Draw each structure type's clusters
    this.structureClusters.forEach((clusters, structureType) => {
      // Skip rendering based on toggle settings
      if (!this.shouldShowStructureType(structureType)) return;

      clusters.forEach((cluster) => {
        const cacheKey = `${cluster.centerCol},${cluster.centerRow}`;
        if (!this.scaledCoords.has(cacheKey)) return;

        const { scaledCol, scaledRow } = this.scaledCoords.get(cacheKey)!;

        // Determine the correct label image to use
        let labelImg;
        if (structureType === StructureType.Realm || structureType === StructureType.Village) {
          if (cluster.isMine) {
            labelImg = this.labelImages.get("MY_REALM");
          } else {
            labelImg = this.labelImages.get(`STRUCTURE_${structureType}`);
          }
        } else {
          labelImg = this.labelImages.get(`STRUCTURE_${structureType}`);
        }

        if (!labelImg) return;

        // Draw the structure icon
        this.context.drawImage(
          labelImg,
          scaledCol - this.structureSize.width * (cluster.centerRow % 2 !== 0 ? 1 : 0.5),
          scaledRow - this.structureSize.height / 2,
          this.structureSize.width,
          this.structureSize.height,
        );
      });
    });
  }

  private drawArmies() {
    if (!this.context || !this.showArmies) return;

    // Recalculate clusters only when needed
    if (this.needsReclustering) {
      this.clusterArmies();
    }

    // Draw each cluster
    this.armyClusters.forEach((cluster) => {
      const cacheKey = `${cluster.centerCol},${cluster.centerRow}`;

      if (this.scaledCoords.has(cacheKey)) {
        const { scaledCol, scaledRow } = this.scaledCoords.get(cacheKey)!;
        const labelImg = this.labelImages.get(cluster.isMine ? "MY_ARMY" : "ARMY");
        if (!labelImg) return;

        // Draw the army icon
        this.context.drawImage(
          labelImg,
          scaledCol - this.armySize.width * (cluster.centerRow % 2 !== 0 ? 1 : 0.5),
          scaledRow - this.armySize.height / 2,
          this.armySize.width,
          this.armySize.height,
        );
      }
    });
  }

  private clusterStructures() {
    // Clear existing structure clusters
    this.structureClusters.clear();

    // Process each tile to find structures
    this.tiles.forEach((tile) => {
      if (!tile.occupier_is_structure) return;

      const structureInfo = getStructureInfoFromTileOccupier(tile.occupier_type);
      if (!structureInfo) return;

      const { type: structureType } = structureInfo;
      const playerAddress = useAccountStore.getState().account?.address;
      // Convert occupier_id to string for comparison
      const isMine = playerAddress ? tile.occupier_id.toString() === playerAddress : false;

      // Skip clustering if this type is not visible
      if (!this.shouldShowStructureType(structureType)) return;

      // Get or create cluster array for this structure type
      if (!this.structureClusters.has(structureType)) {
        this.structureClusters.set(structureType, []);
      }

      const clusters = this.structureClusters.get(structureType)!;
      let addedToCluster = false;

      // Try to add to existing cluster
      for (const cluster of clusters) {
        if (cluster.isMine !== isMine) continue;

        const distance = this.hexDistance(tile.col, tile.row, cluster.centerCol, cluster.centerRow);
        if (distance <= this.currentClusterRadius) {
          cluster.entities.push({
            col: tile.col,
            row: tile.row,
            isMine,
            type: structureType,
          });
          addedToCluster = true;
          break;
        }
      }

      // Create new cluster if not added to existing one
      if (!addedToCluster) {
        clusters.push({
          centerCol: tile.col,
          centerRow: tile.row,
          entities: [{ col: tile.col, row: tile.row, isMine, type: structureType }],
          isMine,
          type: structureType,
        });
      }
    });
  }

  private clusterArmies() {
    // Reset army clusters
    this.armyClusters = [];

    const allArmies: HexPosition[] = this.tiles
      .map((tile) => {
        const explorerInfo = getExplorerInfoFromTileOccupier(tile.occupier_type);
        if (!explorerInfo) return null;
        return {
          col: tile.col,
          row: tile.row,
        };
      })
      .filter((army) => army !== null);
    if (allArmies.length === 0) return;

    // Use grid-based spatial partitioning for efficient clustering
    const grid = new Map<string, Array<{ index: number; col: number; row: number; isMine: boolean }>>();

    // Place armies in grid cells
    allArmies.forEach((army, index) => {
      // Calculate grid cell coordinates (larger than actual clustering radius for efficiency)
      const gridCol = Math.floor(army.col / this.currentClusterRadius);
      const gridRow = Math.floor(army.row / this.currentClusterRadius);
      const gridKey = `${gridCol},${gridRow}`;

      if (!grid.has(gridKey)) {
        grid.set(gridKey, []);
      }

      grid.get(gridKey)!.push({
        index,
        col: army.col,
        row: army.row,
        isMine: false,
      });
    });

    const processedArmies = new Set<number>();

    // For each grid cell
    grid.forEach((armies, gridKey) => {
      // Process each army in the cell
      for (const army of armies) {
        if (processedArmies.has(army.index)) continue;

        // Create a new cluster with this army
        const cluster: EntityCluster = {
          centerCol: army.col,
          centerRow: army.row,
          entities: [{ col: army.col, row: army.row, isMine: army.isMine }],
          isMine: army.isMine,
        };

        processedArmies.add(army.index);

        // Check nearby grid cells for armies to include in the cluster
        const [baseGridCol, baseGridRow] = gridKey.split(",").map(Number);

        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const neighborGridKey = `${baseGridCol + dx},${baseGridRow + dy}`;
            const neighborArmies = grid.get(neighborGridKey);

            if (!neighborArmies) continue;

            for (const neighborArmy of neighborArmies) {
              if (processedArmies.has(neighborArmy.index) || neighborArmy.isMine !== army.isMine) continue;

              // Check actual distance
              const distance = this.hexDistance(army.col, army.row, neighborArmy.col, neighborArmy.row);

              if (distance <= this.currentClusterRadius) {
                cluster.entities.push({
                  col: neighborArmy.col,
                  row: neighborArmy.row,
                  isMine: neighborArmy.isMine,
                });
                processedArmies.add(neighborArmy.index);
              }
            }
          }
        }

        this.armyClusters.push(cluster);
      }
    });

    // After clustering is complete, mark as done
    this.needsReclustering = false;
  }

  // Calculate distance between two hex coordinates
  private hexDistance(col1: number, row1: number, col2: number, row2: number): number {
    // Convert axial coordinates to cube coordinates
    const x1 = col1;
    const z1 = row1 - (col1 - (col1 & 1)) / 2;
    const y1 = -x1 - z1;

    const x2 = col2;
    const z2 = row2 - (col2 - (col2 & 1)) / 2;
    const y2 = -x2 - z2;

    // Calculate cube coordinate distance
    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2), Math.abs(z1 - z2));
  }

  // draw quests on the minimap
  private drawQuests() {
    if (!this.context || !this.showQuests) return;

    const allQuests: HexPosition[] = this.tiles
      .map((tile) => {
        const questTile = tile.occupier_type === TileOccupier.Quest;
        if (!questTile) return null;
        return {
          col: tile.col,
          row: tile.row,
        };
      })
      .filter((quest) => quest !== null);

    allQuests.forEach((quest) => {
      const cacheKey = `${quest.col},${quest.row}`;
      if (this.scaledCoords.has(cacheKey)) {
        const { scaledCol, scaledRow } = this.scaledCoords.get(cacheKey)!;
        const labelImg = this.labelImages.get("QUEST");
        if (!labelImg) return;

        this.context.drawImage(
          labelImg,
          scaledCol - this.questSize.width * (quest.row % 2 !== 0 ? 1 : 0.5),
          scaledRow - this.questSize.height / 2,
          this.questSize.width,
          this.questSize.height,
        );
      }
    });
  }

  drawCamera() {
    if (!this.context) return;

    const cameraPosition = this.camera.position;
    const currentCameraView: CameraView = this.worldmapScene.getCurrentCameraView();
    const { col, row } = getHexForWorldPosition(cameraPosition);
    const cacheKey = `${col},${row}`;
    if (this.scaledCoords.has(cacheKey)) {
      const { scaledCol, scaledRow } = this.scaledCoords.get(cacheKey)!;

      this.context.strokeStyle = MINIMAP_CONFIG.COLORS.CAMERA;
      this.context.beginPath();
      if (currentCameraView !== CameraView.Far) {
        this.context.moveTo(scaledCol - this.cameraSize.topSideWidth / 2, scaledRow - this.cameraSize.height);
        this.context.lineTo(scaledCol + this.cameraSize.topSideWidth / 2, scaledRow - this.cameraSize.height);
        this.context.lineTo(scaledCol + this.cameraSize.bottomSideWidth / 2, scaledRow);
        this.context.lineTo(scaledCol - this.cameraSize.bottomSideWidth / 2, scaledRow);
        this.context.lineTo(scaledCol - this.cameraSize.topSideWidth / 2, scaledRow - this.cameraSize.height);
      }
      if (currentCameraView === CameraView.Far) {
        this.context.moveTo(scaledCol - this.cameraSize.topSideWidth, scaledRow - this.cameraSize.height * 2.85);
        this.context.lineTo(scaledCol + this.cameraSize.topSideWidth, scaledRow - this.cameraSize.height * 2.85);
        this.context.lineTo(scaledCol + this.cameraSize.bottomSideWidth, scaledRow - this.cameraSize.height * 0.5);
        this.context.lineTo(scaledCol - this.cameraSize.bottomSideWidth, scaledRow - this.cameraSize.height * 0.5);
        this.context.lineTo(scaledCol - this.cameraSize.topSideWidth, scaledRow - this.cameraSize.height * 2.85);
      }
      this.context.closePath();
      this.context.lineWidth = 1;
      this.context.stroke();
    }
  }

  hideMinimap() {
    this.canvas.style.display = "none";
    useUIStore.getState().setShowMinimap(false);
  }

  showMinimap() {
    this.canvas.style.display = "block";
    useUIStore.getState().setShowMinimap(true);
  }

  moveMinimapCenterToUrlLocation() {
    const url = new URL(window.location.href);
    const col = parseInt(url.searchParams.get("col") || "0");
    const row = parseInt(url.searchParams.get("row") || "0");
    this.mapCenter = { col, row };
    this.recomputeScales();
  }

  // Set the map to maximum distance for screenshots
  setMaxDistance() {
    // Set to maximum distance
    this.mapSize = {
      width: MINIMAP_CONFIG.MAX_ZOOM_RANGE,
      height: MINIMAP_CONFIG.MAP_ROWS_HEIGHT * 3,
    };
    this.recomputeScales();
    this.draw();
  }

  // Center the map at the origin (0,0) for screenshots
  centerAtOrigin() {
    this.mapCenter = { col: 0, row: 0 };
    this.recomputeScales();
    this.draw();
  }

  update() {
    // Only call draw if we have completed initialization
    if (this.context) {
      // Mark as needing reclustering on scene update, but not on every frame
      // This ensures armies that move will eventually get reclustered
      if (Math.random() < 0.1) {
        // Only check occasionally to avoid performance impact
        this.needsReclustering = true;
      }
      this.draw();
    }
  }

  private handleMouseDown = (event: MouseEvent) => {
    this.isDragging = true;
    this.mouseStartPosition = {
      x: event.clientX,
      y: event.clientY,
    };
    this.lastMousePosition = {
      x: event.clientX,
      y: event.clientY,
    };
  };

  private handleMouseMove = (event: MouseEvent) => {
    // Update hovered coordinates
    const { col, row } = this.getMousePosition(event);
    this.hoveredHexCoords = { col, row };

    if (this.isDragging && this.lastMousePosition) {
      const colShift = Math.round((event.clientX - this.lastMousePosition.x) * this.dragSpeed);
      const rowShift = Math.round((event.clientY - this.lastMousePosition.y) * this.dragSpeed);
      this.mapCenter.col -= colShift;
      this.mapCenter.row -= rowShift;

      this.lastMousePosition = {
        x: event.clientX,
        y: event.clientY,
      };

      this.recomputeScales();
      this.draw();
    } else {
      // Redraw only when not dragging to show updated hover coordinates
      this.draw();
    }
  };

  private handleMouseUp = (event: MouseEvent) => {
    if (this.mouseStartPosition) {
      const startX = this.mouseStartPosition.x;
      const startY = this.mouseStartPosition.y;
      const endX = event.clientX;
      const endY = event.clientY;

      const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));

      if (distance < 3) {
        this.handleClick(event);
      }
    }

    this.isDragging = false;
    this.lastMousePosition = null;
    this.mouseStartPosition = null;
  };

  private zoom(zoomOut: boolean, event?: MouseEvent) {
    const currentRange = this.mapSize.width;

    if (!zoomOut && currentRange < MINIMAP_CONFIG.MIN_ZOOM_RANGE) {
      return;
    }
    if (zoomOut && currentRange > MINIMAP_CONFIG.MAX_ZOOM_RANGE) {
      return;
    }

    const ratio = this.canvas.width / this.canvas.height;
    const delta = zoomOut ? -5 : 5;
    const deltaX = Math.round(delta * ratio);
    const deltaY = delta;
    this.mapSize.width -= 2 * deltaX;
    this.mapSize.height -= 2 * deltaY;

    if (!zoomOut && event) {
      const { col, row } = this.getMousePosition(event);
      const colShift = col - this.mapCenter.col;
      const rowShift = row - this.mapCenter.row;
      this.mapCenter.col += Math.round(colShift * 0.15); // Adjust the factor as needed
      this.mapCenter.row += Math.round(rowShift * 0.15); // Adjust the factor as needed
    }

    this.recomputeScales();
    // The recomputeScales method will set needsReclustering if the zoom level changed enough
  }

  private handleWheel = (event: WheelEvent) => {
    event.stopPropagation();
    const zoomOut = event.deltaY > 0; // Zoom out for positive deltaY, zoom in for negative
    this.zoom(zoomOut, event);
  };

  handleClick = (event: MouseEvent) => {
    event.stopPropagation();
    const { col, row, x, y } = this.getMousePosition(event);

    this.worldmapScene.moveCameraToColRow(col, row, 0);
  };

  private handleResize = () => {
    this.recomputeScales();
    this.needsReclustering = true; // Force reclustering on resize
    if (this.context) this.draw();
  };

  private loadLabelImages() {
    // Load army labels
    this.loadImage("ARMY", LABELS.ARMY);
    this.loadImage("MY_ARMY", LABELS.MY_ARMY);
    this.loadImage("MY_REALM", LABELS.MY_REALM);
    this.loadImage("MY_REALM_WONDER", LABELS.MY_REALM_WONDER);
    this.loadImage("REALM_WONDER", LABELS.REALM_WONDER);
    this.loadImage("QUEST", LABELS.QUEST);
    // Load structure labels
    Object.entries(LABELS.STRUCTURES).forEach(([type, path]) => {
      this.loadImage(`STRUCTURE_${type}`, path);
    });
  }

  private loadImage(key: string, path: string) {
    const img = new Image();
    img.src = path;
    this.labelImages.set(key, img);
  }

  private shouldShowStructureType(structureType: StructureType): boolean {
    switch (structureType) {
      case StructureType.Realm:
      case StructureType.Village:
        return this.showRealms;
      case StructureType.Hyperstructure:
        return this.showHyperstructures;
      case StructureType.Bank:
        return this.showBanks;
      case StructureType.FragmentMine:
        return this.showFragmentMines;
      default:
        return true;
    }
  }

  // Toggle visibility methods
  toggleRealms(visible: boolean) {
    this.showRealms = visible;
    if (this.context) this.draw();
  }

  toggleArmies(visible: boolean) {
    this.showArmies = visible;
    if (this.context) this.draw();
  }

  toggleHyperstructures(visible: boolean) {
    this.showHyperstructures = visible;
    if (this.context) this.draw();
  }

  toggleBanks(visible: boolean) {
    this.showBanks = visible;
    if (this.context) this.draw();
  }

  toggleFragmentMines(visible: boolean) {
    this.showFragmentMines = visible;
    if (this.context) this.draw();
  }

  toggleQuests(visible: boolean) {
    this.showQuests = visible;
    if (this.context) this.draw();
  }

  // Method to get current visibility states for UI
  getVisibilityStates() {
    return {
      realms: this.showRealms,
      armies: this.showArmies,
      hyperstructures: this.showHyperstructures,
      banks: this.showBanks,
      fragmentMines: this.showFragmentMines,
      quests: this.showQuests,
    };
  }

  // Initialize visibility states based on UI state if available
  syncVisibilityStates(states: {
    realms?: boolean;
    armies?: boolean;
    hyperstructures?: boolean;
    banks?: boolean;
    fragmentMines?: boolean;
    quests?: boolean;
  }) {
    if (states.realms !== undefined) this.showRealms = states.realms;
    if (states.armies !== undefined) this.showArmies = states.armies;
    if (states.hyperstructures !== undefined) this.showHyperstructures = states.hyperstructures;
    if (states.banks !== undefined) this.showBanks = states.banks;
    if (states.fragmentMines !== undefined) this.showFragmentMines = states.fragmentMines;
    if (states.quests !== undefined) this.showQuests = states.quests;
    if (this.context) this.draw();
  }

  private async fetchTiles() {
    console.log("fetchTiles");
    try {
      this.tiles = await sqlApi.fetchAllTiles().then((tiles) => {
        return tiles.map((tile) => {
          const position = new Position({ x: tile.col, y: tile.row });
          const { x: col, y: row } = position.getNormalized();
          return {
            ...tile,
            col,
            row,
          };
        });
      });
      this.draw(); // Redraw the minimap with new data
    } catch (error) {
      console.error("Failed to fetch tiles:", error);
    }
  }

  // New method to draw the hovered coordinates
  private drawHoveredCoordinates() {
    if (!this.context || !this.hoveredHexCoords) return;

    const { col, row } = this.hoveredHexCoords;
    const text = `(${col}, ${row})`;

    // Save current context state
    this.context.save();

    // Set text style
    this.context.font = "14px Arial";
    this.context.fillStyle = "#FFFFFF";
    this.context.textBaseline = "bottom";

    // Add background for better readability
    const textMetrics = this.context.measureText(text);
    const padding = 5;
    this.context.fillStyle = "rgba(0, 0, 0, 0.7)";
    this.context.fillRect(padding, this.canvas.height - padding - 16, textMetrics.width + padding * 2, 16 + padding);

    // Draw text
    this.context.fillStyle = "#FFFFFF";
    this.context.fillText(text, padding * 2, this.canvas.height - padding);

    // Restore context state
    this.context.restore();
  }

  // New method to handle mouse leaving the canvas
  private handleMouseLeave = () => {
    this.hoveredHexCoords = null;
    this.draw();
  };
}

export default Minimap;
