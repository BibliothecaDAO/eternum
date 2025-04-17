import { useUIStore } from "@/hooks/store/use-ui-store";
import { type ArmyManager } from "@/three/managers/army-manager";
import { BIOME_COLORS } from "@/three/managers/biome-colors";
import { type StructureManager } from "@/three/managers/structure-manager";
import type WorldmapScene from "@/three/scenes/worldmap";
import { BiomeType, ResourcesIds, StructureType } from "@bibliothecadao/types";
import throttle from "lodash/throttle";
import type * as THREE from "three";
import { CameraView } from "../scenes/hexagon-scene";
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
};

const MINIMAP_CONFIG = {
  MIN_ZOOM_RANGE: 75,
  MAX_ZOOM_RANGE: 600,
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
};

class Minimap {
  private worldmapScene: WorldmapScene;
  private canvas!: HTMLCanvasElement;
  private context!: CanvasRenderingContext2D;
  private camera!: THREE.PerspectiveCamera;
  private exploredTiles!: Map<number, Map<number, BiomeType>>;
  private structureManager!: StructureManager;
  private armyManager!: ArmyManager;
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
  private cameraSize!: {
    topSideWidth: number;
    bottomSideWidth: number;
    height: number;
  };
  private labelImages = new Map<string, HTMLImageElement>();
  private lastMousePosition: { x: number; y: number } | null = null;
  private mouseStartPosition: { x: number; y: number } | null = null;

  // Entity visibility toggles
  private showRealms: boolean = true;
  private showArmies: boolean = true;
  private showHyperstructures: boolean = true;
  private showBanks: boolean = true;
  private showFragmentMines: boolean = true;

  constructor(
    worldmapScene: WorldmapScene,
    exploredTiles: Map<number, Map<number, BiomeType>>,
    camera: THREE.PerspectiveCamera,
    structureManager: StructureManager,
    armyManager: ArmyManager,
  ) {
    this.worldmapScene = worldmapScene;

    // Expose the minimap instance globally for UI access
    (window as any).minimapInstance = this;

    this.waitForMinimapElement().then((canvas) => {
      this.canvas = canvas;
      this.loadLabelImages();
      this.initializeCanvas(structureManager, exploredTiles, armyManager, camera);
      this.canvas.addEventListener("canvasResized", this.handleResize);
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

  private initializeCanvas(
    structureManager: StructureManager,
    exploredTiles: Map<number, Map<number, BiomeType>>,
    armyManager: ArmyManager,
    camera: THREE.PerspectiveCamera,
  ) {
    this.context = this.canvas.getContext("2d")!;
    this.structureManager = structureManager;
    this.exploredTiles = exploredTiles;
    this.armyManager = armyManager;
    this.camera = camera;
    this.scaleX = this.canvas.width / this.mapSize.width;
    this.scaleY = this.canvas.height / this.mapSize.height;
    this.biomeCache = new Map();
    this.scaledCoords = new Map();
    this.structureSize = { width: 0, height: 0 };
    this.armySize = { width: 0, height: 0 };
    this.cameraSize = { topSideWidth: 0, bottomSideWidth: 0, height: 0 };
    this.recomputeScales();

    this.draw = throttle(this.draw, 1000 / 30);

    this.canvas.addEventListener("mousedown", this.handleMouseDown);
    this.canvas.addEventListener("mousemove", this.handleMouseMove);
    this.canvas.addEventListener("mouseup", this.handleMouseUp);
    this.canvas.addEventListener("wheel", this.handleWheel);
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
    this.cameraSize = {
      topSideWidth: (window.innerWidth / MINIMAP_CONFIG.SIZES.CAMERA.TOP_SIDE_WIDTH_FACTOR) * this.scaleX,
      bottomSideWidth: (window.innerWidth / MINIMAP_CONFIG.SIZES.CAMERA.BOTTOM_SIDE_WIDTH_FACTOR) * this.scaleX,
      height: MINIMAP_CONFIG.SIZES.CAMERA.HEIGHT_FACTOR * this.scaleY,
    };
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
    this.drawCamera();
  }

  private drawExploredTiles() {
    if (!this.context) return;

    this.exploredTiles.forEach((rows, col) => {
      rows.forEach((biome, row) => {
        const cacheKey = `${col},${row}`;
        let biomeColor;

        if (this.biomeCache.has(cacheKey)) {
          biomeColor = this.biomeCache.get(cacheKey)!;
        } else {
          biomeColor = BIOME_COLORS[biome].getStyle();
          this.biomeCache.set(cacheKey, biomeColor);
        }
        if (this.scaledCoords.has(cacheKey)) {
          const { scaledCol, scaledRow } = this.scaledCoords.get(cacheKey)!;
          this.context.fillStyle = biomeColor;
          this.context.fillRect(
            scaledCol - this.scaleX * (row % 2 !== 0 ? 1 : 0.5),
            scaledRow - this.scaleY / 2,
            this.scaleX,
            this.scaleY,
          );
        }
      });
    });
  }

  private drawStructures() {
    if (!this.context) return;

    const allStructures = this.structureManager.structures.getStructures();
    for (const [structureType, structures] of allStructures) {
      // Skip rendering based on toggle settings
      if (!this.shouldShowStructureType(structureType)) continue;

      let labelImg = this.labelImages.get(`STRUCTURE_${structureType}`);
      if (!labelImg) continue;

      structures.forEach((structure) => {
        if (structureType === StructureType.Realm || structureType === StructureType.Village) {
          if (structure.isMine) {
            labelImg = structure.hasWonder ? this.labelImages.get("MY_REALM_WONDER") : this.labelImages.get("MY_REALM");
          } else {
            labelImg = structure.hasWonder
              ? this.labelImages.get("REALM_WONDER")
              : this.labelImages.get(`STRUCTURE_${structureType}`);
          }
        }
        if (!labelImg) return;
        const { col, row } = structure.hexCoords;
        const cacheKey = `${col},${row}`;
        if (this.scaledCoords.has(cacheKey)) {
          const { scaledCol, scaledRow } = this.scaledCoords.get(cacheKey)!;
          this.context.drawImage(
            labelImg,
            scaledCol - this.structureSize.width * (row % 2 !== 0 ? 1 : 0.5),
            scaledRow - this.structureSize.height / 2,
            this.structureSize.width,
            this.structureSize.height,
          );
        }
      });
    }
  }

  private drawArmies() {
    if (!this.context || !this.showArmies) return;

    const allArmies = this.armyManager.getArmies();
    allArmies.forEach((army) => {
      const { x: col, y: row } = army.hexCoords.getNormalized();
      const cacheKey = `${col},${row}`;
      if (this.scaledCoords.has(cacheKey)) {
        const { scaledCol, scaledRow } = this.scaledCoords.get(cacheKey)!;
        const labelImg = this.labelImages.get(army.isMine ? "MY_ARMY" : "ARMY");
        if (!labelImg) return;

        this.context.drawImage(
          labelImg,
          scaledCol - this.armySize.width * (row % 2 !== 0 ? 1 : 0.5),
          scaledRow - this.armySize.height / 2,
          this.armySize.width,
          this.armySize.height,
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
    if (!this.canvas) return;
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
    if (this.isDragging && this.lastMousePosition) {
      const colShift = Math.round(event.clientX - this.lastMousePosition.x);
      const rowShift = Math.round(event.clientY - this.lastMousePosition.y);
      this.mapCenter.col -= colShift;
      this.mapCenter.row -= rowShift;

      this.lastMousePosition = {
        x: event.clientX,
        y: event.clientY,
      };

      this.recomputeScales();
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
    if (this.context) this.draw();
  };

  private loadLabelImages() {
    // Load army labels
    this.loadImage("ARMY", LABELS.ARMY);
    this.loadImage("MY_ARMY", LABELS.MY_ARMY);
    this.loadImage("MY_REALM", LABELS.MY_REALM);
    this.loadImage("MY_REALM_WONDER", LABELS.MY_REALM_WONDER);
    this.loadImage("REALM_WONDER", LABELS.REALM_WONDER);

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

  // Method to get current visibility states for UI
  getVisibilityStates() {
    return {
      realms: this.showRealms,
      armies: this.showArmies,
      hyperstructures: this.showHyperstructures,
      banks: this.showBanks,
      fragmentMines: this.showFragmentMines,
    };
  }

  // Initialize visibility states based on UI state if available
  syncVisibilityStates(states: {
    realms?: boolean;
    armies?: boolean;
    hyperstructures?: boolean;
    banks?: boolean;
    fragmentMines?: boolean;
  }) {
    if (states.realms !== undefined) this.showRealms = states.realms;
    if (states.armies !== undefined) this.showArmies = states.armies;
    if (states.hyperstructures !== undefined) this.showHyperstructures = states.hyperstructures;
    if (states.banks !== undefined) this.showBanks = states.banks;
    if (states.fragmentMines !== undefined) this.showFragmentMines = states.fragmentMines;
    if (this.context) this.draw();
  }
}

export default Minimap;
