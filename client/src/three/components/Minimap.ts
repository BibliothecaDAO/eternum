import useUIStore from "@/hooks/store/useUIStore";
import { FELT_CENTER } from "@/ui/config";
import { getHexForWorldPosition } from "@/ui/utils/utils";
import { StructureType } from "@bibliothecadao/eternum";
import throttle from "lodash/throttle";
import type * as THREE from "three";
import type WorldmapScene from "../scenes/Worldmap";
import { type ArmyManager } from "./ArmyManager";
import { type BattleManager } from "./BattleManager";
import { type Biome, BIOME_COLORS } from "./Biome";
import { type StructureManager } from "./StructureManager";

const LABELS = {
  ARMY: "/textures/army_label.png",
  MY_ARMY: "/textures/my_army_label.png",
  MY_REALM: "/textures/my_realm_label.png",
  BATTLE: "/textures/battle_label.png",
  STRUCTURES: {
    [StructureType.Realm]: "/textures/realm_label.png",
    [StructureType.Hyperstructure]: "/textures/hyper_label.png",
    [StructureType.Bank]: "/images/resources/coin.png",
    [StructureType.FragmentMine]: "/textures/fragment_mine_label.png",
    [StructureType.Settlement]: "/textures/realm_label.png",
  },
};

const MINIMAP_CONFIG = {
  MIN_ZOOM_RANGE: 75,
  MAX_ZOOM_RANGE: 300,
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
      [StructureType.Settlement]: "#FFA500",
    },
  },
  SIZES: {
    BATTLE: 12,
    STRUCTURE: 10,
    ARMY: 10,
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
  private exploredTiles!: Map<number, Set<number>>;
  private structureManager!: StructureManager;
  private armyManager!: ArmyManager;
  private battleManager!: BattleManager;
  private biome!: Biome;
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
  private battleSize!: { width: number; height: number };
  private cameraSize!: {
    topSideWidth: number;
    bottomSideWidth: number;
    height: number;
  };
  private labelImages = new Map<string, HTMLImageElement>();
  private lastMousePosition: { x: number; y: number } | null = null;
  private mouseStartPosition: { x: number; y: number } | null = null;

  constructor(
    worldmapScene: WorldmapScene,
    exploredTiles: Map<number, Set<number>>,
    camera: THREE.PerspectiveCamera,
    structureManager: StructureManager,
    armyManager: ArmyManager,
    battleManager: BattleManager,
    biome: Biome,
  ) {
    this.worldmapScene = worldmapScene;
    this.waitForMinimapElement().then((canvas) => {
      this.canvas = canvas;
      this.loadLabelImages();
      this.initializeCanvas(structureManager, exploredTiles, armyManager, biome, camera, battleManager);
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
    exploredTiles: Map<number, Set<number>>,
    armyManager: ArmyManager,
    biome: Biome,
    camera: THREE.PerspectiveCamera,
    battleManager: BattleManager,
  ) {
    this.context = this.canvas.getContext("2d")!;
    this.structureManager = structureManager;
    this.exploredTiles = exploredTiles;
    this.armyManager = armyManager;
    this.battleManager = battleManager;
    this.biome = biome;
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
    // Precompute sizes
    this.structureSize = {
      width: MINIMAP_CONFIG.SIZES.STRUCTURE * this.scaleX * modifier,
      height: MINIMAP_CONFIG.SIZES.STRUCTURE * this.scaleX * modifier,
    };
    this.armySize = {
      width: MINIMAP_CONFIG.SIZES.ARMY * this.scaleX * modifier,
      height: MINIMAP_CONFIG.SIZES.ARMY * this.scaleX * modifier,
    };
    this.battleSize = {
      width: MINIMAP_CONFIG.SIZES.BATTLE * this.scaleX * modifier,
      height: MINIMAP_CONFIG.SIZES.BATTLE * this.scaleX * modifier,
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
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawExploredTiles();
    this.drawStructures();
    this.drawArmies();
    this.drawBattles();
    this.drawCamera();
  }

  private drawExploredTiles() {
    this.exploredTiles.forEach((rows, col) => {
      rows.forEach((row) => {
        const cacheKey = `${col},${row}`;
        let biomeColor;

        if (this.biomeCache.has(cacheKey)) {
          biomeColor = this.biomeCache.get(cacheKey)!;
        } else {
          const biome = this.biome.getBiome(col + FELT_CENTER, row + FELT_CENTER);
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
    const allStructures = this.structureManager.structures.getStructures();
    for (const [structureType, structures] of allStructures) {
      let labelImg = this.labelImages.get(`STRUCTURE_${structureType}`);
      if (!labelImg) continue;

      structures.forEach((structure) => {
        if (structureType === StructureType.Realm) {
          labelImg = structure.isMine
            ? this.labelImages.get("MY_REALM")
            : this.labelImages.get(`STRUCTURE_${structureType}`);
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

  private drawBattles() {
    const allBattles = this.battleManager.getAll();
    allBattles.forEach((battle) => {
      const { x: col, y: row } = battle.position.getNormalized();
      const cacheKey = `${col},${row}`;
      if (this.scaledCoords.has(cacheKey)) {
        const { scaledCol, scaledRow } = this.scaledCoords.get(cacheKey)!;
        const labelImg = this.labelImages.get("BATTLE");
        if (!labelImg) return;

        this.context.drawImage(
          labelImg,
          scaledCol - this.battleSize.width * (row % 2 !== 0 ? 1 : 0.5),
          scaledRow - this.battleSize.height / 2,
          this.battleSize.width,
          this.battleSize.height,
        );
      }
    });
  }

  drawCamera() {
    const cameraPosition = this.camera.position;
    const { col, row } = getHexForWorldPosition(cameraPosition);
    const cacheKey = `${col},${row}`;
    if (this.scaledCoords.has(cacheKey)) {
      const { scaledCol, scaledRow } = this.scaledCoords.get(cacheKey)!;

      this.context.strokeStyle = MINIMAP_CONFIG.COLORS.CAMERA;
      this.context.beginPath();
      this.context.moveTo(scaledCol - this.cameraSize.topSideWidth / 2, scaledRow - this.cameraSize.height);
      this.context.lineTo(scaledCol + this.cameraSize.topSideWidth / 2, scaledRow - this.cameraSize.height);
      this.context.lineTo(scaledCol + this.cameraSize.bottomSideWidth / 2, scaledRow);
      this.context.lineTo(scaledCol - this.cameraSize.bottomSideWidth / 2, scaledRow);
      this.context.lineTo(scaledCol - this.cameraSize.topSideWidth / 2, scaledRow - this.cameraSize.height);
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

  update() {
    this.draw();
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
    this.draw();
  };

  private loadLabelImages() {
    // Load army labels
    this.loadImage("ARMY", LABELS.ARMY);
    this.loadImage("MY_ARMY", LABELS.MY_ARMY);
    this.loadImage("BATTLE", LABELS.BATTLE);
    this.loadImage("MY_REALM", LABELS.MY_REALM);

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
}

export default Minimap;
