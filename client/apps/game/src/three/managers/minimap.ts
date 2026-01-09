import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { getGameModeConfig } from "@/config/game-modes";
import type { GameModeConfig } from "@/config/game-modes";
import { BIOME_COLORS } from "@/three/managers/biome-colors";
import type WorldmapScene from "@/three/scenes/worldmap";
import { playerColorManager } from "@/three/systems/player-colors";
import {
  getExplorerInfoFromTileOccupier,
  getStructureInfoFromTileOccupier,
  Position,
  tileOptToTile,
} from "@bibliothecadao/eternum";

import {
  BiomeIdToType,
  HexPosition,
  ResourcesIds,
  StructureType,
  Tile,
  TileOccupier,
  TileOpt,
} from "@bibliothecadao/types";
import type { Clause, Entity as ToriiEntity, ToriiClient } from "@dojoengine/torii-wasm/types";
import throttle from "lodash/throttle";
import type * as THREE from "three";
import { CameraView } from "../scenes/hexagon-scene";
import { HEX_SIZE } from "../constants/scene-constants";

const LABELS = (fragmentMineIcon: string) => ({
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
    [StructureType.FragmentMine]: fragmentMineIcon,
  },
  MY_STRUCTURES: {
    [StructureType.Village]: "/images/labels/village.png",
    [StructureType.Realm]: "/images/labels/realm.png",
  },
  QUEST: "/images/labels/quest.png",
});

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
    ownerId?: string; // Owner address for player color distinction
  }[];
  isMine: boolean;
  type?: StructureType; // Only for structures
  ownerId?: string; // Owner address for player color distinction
}

// Keep ArmyCluster for backward compatibility
interface ArmyCluster extends EntityCluster {}

class Minimap {
  private mode: GameModeConfig;
  private worldmapScene: WorldmapScene;
  private canvas!: HTMLCanvasElement;
  private context!: CanvasRenderingContext2D;
  private staticLayerCanvas!: HTMLCanvasElement;
  private staticLayerContext!: CanvasRenderingContext2D;
  private needsStaticRedraw: boolean = true;
  private camera!: THREE.PerspectiveCamera;
  private mapCenter: { col: number; row: number } = { col: 250, row: 150 };
  private mapSize: { width: number; height: number } = {
    width: MINIMAP_CONFIG.MAP_COLS_WIDTH,
    height: MINIMAP_CONFIG.MAP_ROWS_HEIGHT,
  };
  private worldBounds: { minCol: number; maxCol: number; minRow: number; maxRow: number } | null = null;
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
  private tiles: Tile[] = [];
  private tileMap: Map<string, Tile> = new Map(); // Fast lookup for tiles by coordinate
  private hoveredHexCoords: { col: number; row: number } | null = null; // New property for tracking hovered hex
  private isMinimized: boolean = false; // Add minimized state
  private tilesRefreshIntervalId: number | null = null;
  private isFetchingTiles: boolean = false;
  private isVisible: boolean = true;
  private toriiClient: ToriiClient;
  private tileStreamSubscription: { cancel: () => void } | null = null;

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
  private syncCameraToMinimapCenter!: () => void;
  private lastCameraTarget: THREE.Vector3 | null = null;
  private isSyncingCamera: boolean = false;
  private readonly hexVertDist = HEX_SIZE * 2 * 0.75;
  private readonly hexHorizDist = Math.sqrt(3) * HEX_SIZE;

  constructor(worldmapScene: WorldmapScene, camera: THREE.PerspectiveCamera, toriiClient: ToriiClient) {
    this.worldmapScene = worldmapScene;
    this.toriiClient = toriiClient;
    this.mode = getGameModeConfig();
    this.syncCameraToMinimapCenter = throttle(() => {
      this.isSyncingCamera = true;
      this.worldmapScene.moveCameraToColRow(this.mapCenter.col, this.mapCenter.row, 0.12);
    }, 50);

    // Expose the minimap instance globally for UI access
    (window as any).minimapInstance = this;

    this.waitForMinimapElement()
      .then((canvas) => {
        this.canvas = canvas;
        this.loadLabelImages();
        this.initializeCanvas(camera);
        this.canvas.addEventListener("canvasResized", this.handleResize);
        void this.fetchTiles().then(() => this.startTileStream());
      })
      .catch((error) => {
        console.warn("Minimap: Failed to initialize minimap:", error);
      });
  }

  private async waitForMinimapElement(): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      const MAX_ATTEMPTS = 300; // ~5 seconds at 60fps
      let attempts = 0;

      const checkElement = () => {
        const element = document.getElementById("minimap") as HTMLCanvasElement;
        if (element) {
          resolve(element);
        } else if (attempts >= MAX_ATTEMPTS) {
          console.error("Minimap: minimap element not found after max attempts");
          reject(new Error("minimap element not found"));
        } else {
          attempts++;
          requestAnimationFrame(checkElement);
        }
      };
      checkElement();
    });
  }

  private initializeCanvas(camera: THREE.PerspectiveCamera) {
    this.context = this.canvas.getContext("2d")!;
    this.staticLayerCanvas = document.createElement("canvas");
    this.staticLayerContext = this.staticLayerCanvas.getContext("2d", { alpha: false })!;
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
    const minColRaw = this.mapCenter.col - this.mapSize.width / 2;
    const maxColRaw = this.mapCenter.col + this.mapSize.width / 2;
    const minRowRaw = this.mapCenter.row - this.mapSize.height / 2;
    const maxRowRaw = this.mapCenter.row + this.mapSize.height / 2;

    const minCol = Math.floor(minColRaw);
    const maxCol = Math.ceil(maxColRaw);
    const minRow = Math.floor(minRowRaw);
    const maxRow = Math.ceil(maxRowRaw);

    for (let col = minCol; col <= maxCol; col++) {
      for (let row = minRow; row <= maxRow; row++) {
        const scaledCol = (col - minColRaw) * this.scaleX;
        const scaledRow = (row - minRowRaw) * this.scaleY;
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

    this.resizeStaticLayer();
    this.needsStaticRedraw = true;

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

  private updateMapCenter(col: number, row: number, forceRecompute: boolean = false): boolean {
    const previousCenter = { ...this.mapCenter };
    this.mapCenter = { col, row };
    this.clampMapCenter();

    const centerChanged = previousCenter.col !== this.mapCenter.col || previousCenter.row !== this.mapCenter.row;

    if (!forceRecompute && !centerChanged) {
      return false;
    }

    this.recomputeScales();
    this.needsStaticRedraw = true;
    return centerChanged;
  }

  private getMousePosition(event: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const col = Math.floor(x / this.scaleX + (this.mapCenter.col - this.mapSize.width / 2));
    const row = Math.floor(y / this.scaleY + (this.mapCenter.row - this.mapSize.height / 2));
    return { col, row, x, y };
  }

  draw() {
    if (!this.context) return;

    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // When minimized, don't draw anything - let the UI handle the visual representation
    if (this.isMinimized) {
      return;
    }

    this.drawExploredTiles();
    this.drawStructures();
    this.drawArmies();
    this.drawQuests();
    this.drawCamera();
    this.drawHoveredCoordinates();
  }

  private resizeStaticLayer() {
    if (this.staticLayerCanvas.width !== this.canvas.width || this.staticLayerCanvas.height !== this.canvas.height) {
      this.staticLayerCanvas.width = this.canvas.width;
      this.staticLayerCanvas.height = this.canvas.height;
    }
  }

  private drawExploredTilesToStaticLayer() {
    if (!this.staticLayerContext) return;

    this.staticLayerContext.clearRect(0, 0, this.staticLayerCanvas.width, this.staticLayerCanvas.height);

    // OPTIMIZED: Iterate only visible coordinates instead of all tiles
    for (const [cacheKey, { scaledCol, scaledRow }] of this.scaledCoords) {
      const tile = this.tileMap.get(cacheKey);
      if (tile) {
        let biomeColor;

        if (this.biomeCache.has(cacheKey)) {
          biomeColor = this.biomeCache.get(cacheKey)!;
        } else {
          const biomeType = BiomeIdToType[tile.biome];
          biomeColor = BIOME_COLORS[biomeType].getStyle();
          this.biomeCache.set(cacheKey, biomeColor);
        }

        this.staticLayerContext.fillStyle = biomeColor;
        this.staticLayerContext.fillRect(
          scaledCol - this.scaleX * (tile.row % 2 !== 0 ? 1 : 0.5),
          scaledRow - this.scaleY / 2,
          this.scaleX,
          this.scaleY,
        );
      }
    }
    this.needsStaticRedraw = false;
  }

  private drawExploredTiles() {
    if (!this.context) return;

    if (this.needsStaticRedraw) {
      this.drawExploredTilesToStaticLayer();
    }

    this.context.drawImage(this.staticLayerCanvas, 0, 0);
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

        const drawX = scaledCol - this.armySize.width * (cluster.centerRow % 2 !== 0 ? 1 : 0.5);
        const drawY = scaledRow - this.armySize.height / 2;

        // Draw player-colored indicator ring behind the icon for enemy armies
        // This allows distinguishing different enemy players on the minimap
        if (!cluster.isMine && cluster.ownerId) {
          const profile = playerColorManager.getEnemyProfile(cluster.ownerId);
          const ringColor = `#${profile.minimap.getHexString()}`;

          // Draw colored ring/glow behind the icon
          this.context.save();
          this.context.beginPath();
          this.context.arc(
            drawX + this.armySize.width / 2,
            drawY + this.armySize.height / 2,
            this.armySize.width * 0.6,
            0,
            Math.PI * 2,
          );
          this.context.fillStyle = ringColor;
          this.context.globalAlpha = 0.6;
          this.context.fill();
          this.context.restore();
        }

        // Draw the army icon
        this.context.drawImage(labelImg, drawX, drawY, this.armySize.width, this.armySize.height);
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

    const playerAddress = useAccountStore.getState().account?.address;

    // Extract army data with owner information for player color distinction
    const allArmies = this.tiles
      .map((tile) => {
        const explorerInfo = getExplorerInfoFromTileOccupier(tile.occupier_type);
        if (!explorerInfo) return null;
        const ownerId = tile.occupier_id?.toString();
        const isMine = playerAddress ? ownerId === playerAddress : false;
        return {
          col: tile.col,
          row: tile.row,
          isMine,
          ownerId,
        };
      })
      .filter((army): army is NonNullable<typeof army> => army !== null);

    if (allArmies.length === 0) return;

    // Use grid-based spatial partitioning for efficient clustering
    const grid = new Map<
      string,
      Array<{ index: number; col: number; row: number; isMine: boolean; ownerId?: string }>
    >();

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
        isMine: army.isMine,
        ownerId: army.ownerId,
      });
    });

    const processedArmies = new Set<number>();

    // For each grid cell
    grid.forEach((armies, gridKey) => {
      // Process each army in the cell
      for (const army of armies) {
        if (processedArmies.has(army.index)) continue;

        // Create a new cluster with this army
        // Include ownerId for player-specific coloring on the minimap
        const cluster: EntityCluster = {
          centerCol: army.col,
          centerRow: army.row,
          entities: [{ col: army.col, row: army.row, isMine: army.isMine, ownerId: army.ownerId }],
          isMine: army.isMine,
          ownerId: army.ownerId,
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
              // Only cluster armies from the same owner for consistent coloring
              if (processedArmies.has(neighborArmy.index) || neighborArmy.ownerId !== army.ownerId) continue;

              // Check actual distance
              const distance = this.hexDistance(army.col, army.row, neighborArmy.col, neighborArmy.row);

              if (distance <= this.currentClusterRadius) {
                cluster.entities.push({
                  col: neighborArmy.col,
                  row: neighborArmy.row,
                  isMine: neighborArmy.isMine,
                  ownerId: neighborArmy.ownerId,
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
    // Disabled camera footprint rendering per feedback
  }

  hideMinimap() {
    if (this.canvas) {
      this.canvas.style.display = "none";
    }
    useUIStore.getState().setShowMinimap(false);
    this.isVisible = false;
    this.stopTilesRefreshLoop();
  }

  showMinimap() {
    if (this.canvas) {
      this.canvas.style.display = "block";
    }
    useUIStore.getState().setShowMinimap(true);
    this.isVisible = true;
    if (this.tilesRefreshIntervalId === null) {
      this.startTilesRefreshLoop();
    }
  }

  minimizeMinimap() {
    this.setMinimized(true);
  }

  // Set minimized state
  setMinimized(minimized: boolean) {
    this.isMinimized = minimized;
    if (this.isMinimized) {
      this.stopTilesRefreshLoop();
    } else if (this.isVisible && this.tilesRefreshIntervalId === null) {
      this.startTilesRefreshLoop();
    }
    if (this.context) {
      this.draw();
    }
  }

  // Get minimized state
  getMinimized(): boolean {
    return this.isMinimized;
  }

  moveMinimapCenterToUrlLocation() {
    const url = new URL(window.location.href);
    const col = parseInt(url.searchParams.get("col") || "0");
    const row = parseInt(url.searchParams.get("row") || "0");
    this.updateMapCenter(col, row);
  }

  // Set the map to maximum distance for screenshots
  setMaxDistance() {
    // Set to maximum distance
    this.mapSize = {
      width: MINIMAP_CONFIG.MAX_ZOOM_RANGE,
      height: MINIMAP_CONFIG.MAP_ROWS_HEIGHT * 3,
    };
    this.clampMapCenter();
    this.recomputeScales();
    this.resizeStaticLayer();
    this.needsStaticRedraw = true;
    this.draw();
  }

  // Center the map at the origin (0,0) for screenshots
  centerAtOrigin() {
    this.mapCenter = { col: 0, row: 0 };
    this.clampMapCenter();
    this.recomputeScales();
    this.needsStaticRedraw = true;
    this.draw();
  }

  update() {
    // Only call draw if we have completed initialization
    if (this.context) {
      if (!this.isDragging && !this.isMinimized) {
        // Keep the minimap centered on the current camera target when the world view moves
        this.syncToCameraTarget();
      }
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
    // Don't allow dragging when minimized
    if (this.isMinimized) return;

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
    // Don't update hover coordinates when minimized
    if (!this.isMinimized) {
      // Update hovered coordinates
      const { col, row } = this.getMousePosition(event);
      this.hoveredHexCoords = { col, row };
    }

    if (this.isDragging && this.lastMousePosition && !this.isMinimized) {
      const colShift = Math.round((event.clientX - this.lastMousePosition.x) * this.dragSpeed);
      const rowShift = Math.round((event.clientY - this.lastMousePosition.y) * this.dragSpeed);
      const nextCol = this.mapCenter.col - colShift;
      const nextRow = this.mapCenter.row - rowShift;

      this.lastMousePosition = {
        x: event.clientX,
        y: event.clientY,
      };

      const centerChanged = this.updateMapCenter(nextCol, nextRow);
      if (centerChanged) {
        this.syncCameraToMinimapCenter();
      }
      this.draw();
    } else if (!this.isMinimized) {
      // Redraw only when not dragging to show updated hover coordinates
      this.draw();
    }
  };

  private handleMouseUp = (event: MouseEvent) => {
    if (this.mouseStartPosition && !this.isMinimized) {
      const startX = this.mouseStartPosition.x;
      const startY = this.mouseStartPosition.y;
      const endX = event.clientX;
      const endY = event.clientY;

      const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));

      if (distance < 3) {
        this.handleClick(event);
      }
    }

    // If dragging finished, we need to update static layer with new position
    if (this.isDragging && !this.isMinimized) {
      this.needsStaticRedraw = true;
      this.draw();
    }

    this.isDragging = false;
    this.lastMousePosition = null;
    this.mouseStartPosition = null;
  };

  private zoom(zoomOut: boolean, event?: MouseEvent) {
    // Don't allow zooming when minimized
    if (this.isMinimized) return;

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

    let nextCol = this.mapCenter.col;
    let nextRow = this.mapCenter.row;

    if (!zoomOut && event) {
      const { col, row } = this.getMousePosition(event);
      const colShift = col - this.mapCenter.col;
      const rowShift = row - this.mapCenter.row;
      nextCol += Math.round(colShift * 0.15); // Adjust the factor as needed
      nextRow += Math.round(rowShift * 0.15); // Adjust the factor as needed
    }

    const centerChanged = this.updateMapCenter(nextCol, nextRow, true);
    if (centerChanged) {
      this.syncCameraToMinimapCenter();
    }
    this.draw();
    // The recomputeScales method will set needsReclustering if the zoom level changed enough
  }

  private handleWheel = (event: WheelEvent) => {
    // Don't allow wheel events when minimized
    if (this.isMinimized) return;

    event.stopPropagation();
    const zoomOut = event.deltaY > 0; // Zoom out for positive deltaY, zoom in for negative
    this.zoom(zoomOut, event);
  };

  handleClick = (event: MouseEvent) => {
    // Don't handle clicks for navigation when minimized
    if (this.isMinimized) return;

    event.stopPropagation();
    const { col, row, x, y } = this.getMousePosition(event);

    this.worldmapScene.moveCameraToColRow(col, row, 0);
  };

  private handleResize = () => {
    this.recomputeScales();
    this.resizeStaticLayer();
    this.needsStaticRedraw = true;
    this.needsReclustering = true; // Force reclustering on resize
    if (this.context) this.draw();
  };

  private loadLabelImages() {
    const labels = LABELS(this.mode.assets.labels.fragmentMine);
    // Load army labels
    this.loadImage("ARMY", labels.ARMY);
    this.loadImage("MY_ARMY", labels.MY_ARMY);
    this.loadImage("MY_REALM", labels.MY_REALM);
    this.loadImage("MY_REALM_WONDER", labels.MY_REALM_WONDER);
    this.loadImage("REALM_WONDER", labels.REALM_WONDER);
    this.loadImage("QUEST", labels.QUEST);
    // Load structure labels
    Object.entries(labels.STRUCTURES).forEach(([type, path]) => {
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

  private stopTilesRefreshLoop() {
    if (this.tilesRefreshIntervalId !== null) {
      window.clearInterval(this.tilesRefreshIntervalId);
      this.tilesRefreshIntervalId = null;
    }
  }

  private startTilesRefreshLoop() {
    // Torii streams now provide tile deltas; polling is no longer required.
    this.stopTilesRefreshLoop();
  }

  private shouldPollTiles() {
    return false;
  }

  private async fetchTiles() {
    if (this.isFetchingTiles) return;
    this.isFetchingTiles = true;
    const getTimestamp = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
    const startTime = getTimestamp();
    try {
      const tiles: Tile[] = [];
      const limit = 40_000;
      let cursor: string | undefined;
      const clause: Clause = {
        Keys: {
          keys: [undefined, undefined, undefined],
          pattern_matching: "FixedLen",
          models: ["s1_eternum-TileOpt"],
        },
      };

      while (true) {
        const page = await this.toriiClient.getEntities({
          pagination: { limit, cursor, direction: "Forward", order_by: [] },
          clause,
          no_hashed_keys: false,
          models: ["s1_eternum-TileOpt"],
          historical: false,
        });

        page.items.forEach((entity) => {
          const tile = this.extractTileFromToriiEntity(entity);
          if (tile) tiles.push(tile);
        });

        if (page.items.length < limit || !page.next_cursor) {
          break;
        }
        cursor = page.next_cursor;
      }

      const fetchEndTime = getTimestamp();
      this.tiles = tiles;
      this.tileMap.clear();
      this.tiles.forEach((tile) => {
        this.tileMap.set(`${tile.col},${tile.row}`, tile);
      });
      this.updateWorldBounds();
      this.clampMapCenter();
      this.recomputeScales();
      this.needsStaticRedraw = true; // New tiles, need redraw
      this.draw(); // Redraw the minimap with new data
      const endTime = getTimestamp();
      const fetchDuration = fetchEndTime - startTime;
      const postProcessDuration = endTime - fetchEndTime;
      const totalDuration = endTime - startTime;
      void fetchDuration;
      void postProcessDuration;
      void totalDuration;
    } catch (error) {
      console.error("Failed to fetch tiles:", error);
    } finally {
      this.isFetchingTiles = false;
    }
  }

  private startTileStream = async () => {
    if (this.tileStreamSubscription) return;

    const clause: Clause = {
      Keys: {
        keys: [undefined, undefined, undefined],
        pattern_matching: "FixedLen",
        models: ["s1_eternum-TileOpt"],
      },
    };

    try {
      this.tileStreamSubscription = await this.toriiClient.onEntityUpdated(clause, (entity: ToriiEntity) => {
        this.handleTileEntityUpdate(entity);
      });
    } catch (error) {
      console.warn("[Minimap] Failed to subscribe to tile stream", error);
    }
  };

  private handleTileEntityUpdate(entity: ToriiEntity) {
    if (!entity?.models || Object.keys(entity.models).length === 0) {
      return;
    }

    const tile = this.extractTileFromToriiEntity(entity);
    if (!tile) return;

    const key = `${tile.col},${tile.row}`;
    const existing = this.tileMap.get(key);

    if (existing) {
      const biomeChanged = existing.biome !== tile.biome;
      existing.biome = tile.biome;
      existing.occupier_id = tile.occupier_id;
      existing.occupier_type = tile.occupier_type;
      existing.occupier_is_structure = tile.occupier_is_structure;
      if (biomeChanged) {
        this.needsStaticRedraw = true;
      }
    } else {
      this.tileMap.set(key, tile);
      this.tiles.push(tile);
      this.updateWorldBoundsWithTile(tile);
      this.clampMapCenter();
      this.recomputeScales();
      this.needsStaticRedraw = true;
    }

    this.needsReclustering = true;
  }

  private extractTileFromToriiEntity(entity: ToriiEntity): Tile | null {
    const tileModel = entity.models?.["s1_eternum-TileOpt"];
    if (!tileModel) return null;

    const readNumber = (field: string) => {
      const ty = (tileModel as any)[field];
      if (!ty) return 0;
      const value = (ty as any).value;
      return typeof value === "number" ? value : Number(value);
    };

    const readBoolean = (field: string) => {
      const ty = (tileModel as any)[field];
      if (!ty) return false;
      const value = (ty as any).value;
      if (typeof value === "boolean") return value;
      if (typeof value === "number") return value !== 0;
      if (typeof value === "string") return value === "true" || value === "1";
      return Boolean(value);
    };

    const readBigInt = (field: string) => {
      const ty = (tileModel as any)[field];
      if (!ty) return 0n;
      const value = (ty as any).value;
      return typeof value === "bigint" ? value : BigInt(value);
    };

    const colRaw = readNumber("col");
    const rowRaw = readNumber("row");
    const alt = readBoolean("alt");
    const data = readBigInt("data");

    const position = new Position({ x: colRaw, y: rowRaw });
    const { x: col, y: row } = position.getNormalized();

    const tileOpt: TileOpt = {
      alt,
      col: colRaw,
      row: rowRaw,
      data,
    };

    const tile = tileOptToTile(tileOpt);

    return {
      ...tile,
      col,
      row,
    };
  }

  private updateWorldBoundsWithTile(tile: Tile) {
    if (!this.worldBounds) {
      this.worldBounds = {
        minCol: tile.col,
        maxCol: tile.col,
        minRow: tile.row,
        maxRow: tile.row,
      };
      return;
    }

    this.worldBounds.minCol = Math.min(this.worldBounds.minCol, tile.col);
    this.worldBounds.maxCol = Math.max(this.worldBounds.maxCol, tile.col);
    this.worldBounds.minRow = Math.min(this.worldBounds.minRow, tile.row);
    this.worldBounds.maxRow = Math.max(this.worldBounds.maxRow, tile.row);
  }

  private updateWorldBounds() {
    if (!this.tiles.length) {
      this.worldBounds = null;
      return;
    }

    let minCol = Infinity;
    let maxCol = -Infinity;
    let minRow = Infinity;
    let maxRow = -Infinity;

    this.tiles.forEach((tile) => {
      if (tile.col < minCol) minCol = tile.col;
      if (tile.col > maxCol) maxCol = tile.col;
      if (tile.row < minRow) minRow = tile.row;
      if (tile.row > maxRow) maxRow = tile.row;
    });

    this.worldBounds = { minCol, maxCol, minRow, maxRow };
  }

  private clampMapCenter() {
    if (!this.worldBounds) return;

    const halfWidth = Math.floor(this.mapSize.width / 2);
    const halfHeight = Math.floor(this.mapSize.height / 2);
    const { minCol, maxCol, minRow, maxRow } = this.worldBounds;

    const minCenterCol = minCol + halfWidth;
    const maxCenterCol = maxCol - halfWidth;
    const minCenterRow = minRow + halfHeight;
    const maxCenterRow = maxRow - halfHeight;

    if (minCenterCol > maxCenterCol) {
      this.mapCenter.col = Math.round((minCol + maxCol) / 2);
    } else {
      this.mapCenter.col = Math.min(Math.max(this.mapCenter.col, minCenterCol), maxCenterCol);
    }

    if (minCenterRow > maxCenterRow) {
      this.mapCenter.row = Math.round((minRow + maxRow) / 2);
    } else {
      this.mapCenter.row = Math.min(Math.max(this.mapCenter.row, minCenterRow), maxCenterRow);
    }
  }

  resetToCameraCenter() {
    this.syncToCameraTarget();
  }

  syncToCameraTarget(forceRedraw: boolean = false) {
    const cameraTarget = this.worldmapScene.getCameraTargetPosition();

    if (this.isSyncingCamera) {
      this.lastCameraTarget = cameraTarget.clone();
      this.isSyncingCamera = false;
      const { col, row } = this.worldmapScene.getCameraTargetHex();
      this.updateMapCenter(col, row, true);
      if (this.context) this.draw();
      return;
    }

    if (!this.lastCameraTarget) {
      this.lastCameraTarget = cameraTarget.clone();
      const { col, row } = this.worldmapScene.getCameraTargetHex();
      this.updateMapCenter(col, row, true);
      if (this.context) this.draw();
      return;
    }

    const deltaX = cameraTarget.x - this.lastCameraTarget.x;
    const deltaZ = cameraTarget.z - this.lastCameraTarget.z;
    this.lastCameraTarget.copy(cameraTarget);

    const nextCol = this.mapCenter.col + deltaX / this.hexHorizDist;
    const nextRow = this.mapCenter.row + deltaZ / this.hexVertDist;
    const changed = this.updateMapCenter(nextCol, nextRow, forceRedraw);
    if ((changed || forceRedraw) && this.context) {
      this.draw();
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
    if (!this.isMinimized) {
      this.hoveredHexCoords = null;
      this.draw();
    }
  };

  public dispose(): void {
    // Remove all event listeners
    if (this.canvas) {
      this.canvas.removeEventListener("mousedown", this.handleMouseDown);
      this.canvas.removeEventListener("mousemove", this.handleMouseMove);
      this.canvas.removeEventListener("mouseup", this.handleMouseUp);
      this.canvas.removeEventListener("wheel", this.handleWheel);
      this.canvas.removeEventListener("mouseleave", this.handleMouseLeave);
      this.canvas.removeEventListener("canvasResized", this.handleResize);
    }

    // Clear all cached data
    this.scaledCoords.clear();

    // Dispose label images
    this.labelImages.forEach((image) => {
      // Set src to empty to help with garbage collection
      image.src = "";
    });
    this.labelImages.clear();

    // Clear canvas context if exists
    if (this.context) {
      this.context.clearRect(0, 0, this.canvas?.width || 0, this.canvas?.height || 0);
    }

    if (this.staticLayerContext) {
      this.staticLayerContext.clearRect(0, 0, this.staticLayerCanvas?.width || 0, this.staticLayerCanvas?.height || 0);
    }

    // Reset references
    this.canvas = null as any;
    this.context = null as any;
    this.staticLayerCanvas = null as any;
    this.staticLayerContext = null as any;
    this.hoveredHexCoords = null;

    if ((window as any).minimapInstance === this) {
      (window as any).minimapInstance = undefined;
    }

    this.stopTilesRefreshLoop();

    if (this.tileStreamSubscription) {
      this.tileStreamSubscription.cancel();
      this.tileStreamSubscription = null;
    }
  }

  public isUserDragging(): boolean {
    return this.isDragging;
  }
}

export default Minimap;
