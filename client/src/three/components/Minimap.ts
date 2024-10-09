import useUIStore from "@/hooks/store/useUIStore";
import { FELT_CENTER } from "@/ui/config";
import { getHexForWorldPosition } from "@/ui/utils/utils";
import { throttle } from "lodash";
import * as THREE from "three";
import WorldmapScene from "../scenes/Worldmap";
import { ArmyManager } from "./ArmyManager";
import { Biome, BIOME_COLORS } from "./Biome";
import { StructureManager } from "./StructureManager";

const MINIMAP_CONFIG = {
  MIN_ZOOM_RANGE: 75,
  MAX_ZOOM_RANGE: 300,
  MAP_COLS_WIDTH: 200,
  MAP_ROWS_HEIGHT: 100,
  COLORS: {
    ARMY: "#FF0000",
    MY_ARMY: "#00FF00",
    CAMERA: "#FFFFFF",
    STRUCTURES: {
      Realm: "#0000ff",
      Hyperstructure: "#FFFFFF",
      Bank: "#FFFF00",
      FragmentMine: "#00FFFF",
      Settlement: "#FFA500",
    },
  },
  SIZES: {
    STRUCTURE: 2,
    ARMY: 2,
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
  private biome!: Biome;
  private displayRange: any = {
    minCol: 150,
    maxCol: 350,
    minRow: 100,
    maxRow: 200,
  };
  private scaleX!: number;
  private scaleY!: number;
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

  constructor(
    worldmapScene: WorldmapScene,
    exploredTiles: Map<number, Set<number>>,
    camera: THREE.PerspectiveCamera,
    structureManager: StructureManager,
    armyManager: ArmyManager,
    biome: Biome,
  ) {
    this.worldmapScene = worldmapScene;
    this.waitForMinimapElement().then((canvas) => {
      this.canvas = canvas;
      this.initializeCanvas(structureManager, exploredTiles, armyManager, biome, camera);
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
  ) {
    this.context = this.canvas.getContext("2d")!;
    this.structureManager = structureManager;
    this.exploredTiles = exploredTiles;
    this.armyManager = armyManager;
    this.biome = biome;
    this.camera = camera;
    this.scaleX = this.canvas.width / (this.displayRange.maxCol - this.displayRange.minCol);
    this.scaleY = this.canvas.height / (this.displayRange.maxRow - this.displayRange.minRow);
    this.biomeCache = new Map();
    this.scaledCoords = new Map();
    this.structureSize = { width: 0, height: 0 };
    this.armySize = { width: 0, height: 0 };
    this.cameraSize = { topSideWidth: 0, bottomSideWidth: 0, height: 0 };
    this.recomputeScales();

    this.draw = throttle(this.draw, 1000 / 30);

    this.canvas.addEventListener("click", this.handleClick);
    this.canvas.addEventListener("mousedown", this.handleMouseDown);
    this.canvas.addEventListener("mousemove", this.handleMouseMove);
    this.canvas.addEventListener("mouseup", this.handleMouseUp);
    this.canvas.addEventListener("wheel", this.handleWheel);
  }

  private recomputeScales() {
    this.scaleX = this.canvas.width / (this.displayRange.maxCol - this.displayRange.minCol);
    this.scaleY = this.canvas.height / (this.displayRange.maxRow - this.displayRange.minRow);
    this.scaledCoords.clear();
    for (let col = this.displayRange.minCol; col <= this.displayRange.maxCol; col++) {
      for (let row = this.displayRange.minRow; row <= this.displayRange.maxRow; row++) {
        const scaledCol = (col - this.displayRange.minCol) * this.scaleX;
        const scaledRow = (row - this.displayRange.minRow) * this.scaleY;
        this.scaledCoords.set(`${col},${row}`, { scaledCol, scaledRow });
      }
    }

    // Precompute sizes
    this.structureSize = {
      width: MINIMAP_CONFIG.SIZES.STRUCTURE * this.scaleX,
      height: MINIMAP_CONFIG.SIZES.STRUCTURE * this.scaleY,
    };
    this.armySize = {
      width: MINIMAP_CONFIG.SIZES.ARMY * this.scaleX,
      height: MINIMAP_CONFIG.SIZES.ARMY * this.scaleY,
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
    const col = Math.floor(x / this.scaleX) + this.displayRange.minCol;
    const row = Math.floor(y / this.scaleY) + this.displayRange.minRow;
    return { col, row, x, y };
  }

  draw() {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawExploredTiles();
    this.drawStructures();
    this.drawArmies();
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
      structures.forEach((structure) => {
        const { col, row } = structure.hexCoords;
        const cacheKey = `${col},${row}`;
        if (this.scaledCoords.has(cacheKey)) {
          const { scaledCol, scaledRow } = this.scaledCoords.get(cacheKey)!;
          // @ts-ignore
          this.context.fillStyle = MINIMAP_CONFIG.COLORS.STRUCTURES[structureType];
          this.context.fillRect(
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
        this.context.fillStyle = army.isMine ? MINIMAP_CONFIG.COLORS.MY_ARMY : MINIMAP_CONFIG.COLORS.ARMY;
        this.context.fillRect(
          scaledCol - this.armySize.width * (row % 2 !== 0 ? 1 : 0.5),
          scaledRow - this.armySize.height / 2,
          this.armySize.width,
          this.armySize.height,
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
    this.canvas.style.display = "block";
    useUIStore.getState().setShowMinimap(true);
  }

  moveMinimapCenterToUrlLocation() {
    const url = new URL(window.location.href);
    const col = parseInt(url.searchParams.get("col") || "0");
    const row = parseInt(url.searchParams.get("row") || "0");
    this.displayRange.minCol = col - MINIMAP_CONFIG.MAP_COLS_WIDTH / 2;
    this.displayRange.maxCol = col + MINIMAP_CONFIG.MAP_COLS_WIDTH / 2;
    this.displayRange.minRow = row - MINIMAP_CONFIG.MAP_ROWS_HEIGHT / 2;
    this.displayRange.maxRow = row + MINIMAP_CONFIG.MAP_ROWS_HEIGHT / 2;
    this.recomputeScales();
  }

  update() {
    this.draw();
  }

  private handleMouseDown = (event: MouseEvent) => {
    this.isDragging = true;
    this.moveCamera(event);
  };

  private handleMouseMove = (event: MouseEvent) => {
    if (this.isDragging) {
      this.moveCamera(event);
    }
  };

  private handleMouseUp = () => {
    this.isDragging = false;
  };

  private moveCamera(event: MouseEvent) {
    const { col, row } = this.getMousePosition(event);
    this.worldmapScene.moveCameraToColRow(col, row, 0);
  }

  private moveMapRange(direction: string) {
    const colShift = Math.round((this.displayRange.maxCol - this.displayRange.minCol) / 4);
    const rowShift = Math.round((this.displayRange.maxRow - this.displayRange.minRow) / 4);

    switch (direction) {
      case "left":
        this.displayRange.minCol -= colShift;
        this.displayRange.maxCol -= colShift;
        break;
      case "right":
        this.displayRange.minCol += colShift;
        this.displayRange.maxCol += colShift;
        break;
      case "top":
        this.displayRange.minRow -= rowShift;
        this.displayRange.maxRow -= rowShift;
        break;
      case "bottom":
        this.displayRange.minRow += rowShift;
        this.displayRange.maxRow += rowShift;
        break;
      default:
        return;
    }
    this.recomputeScales();
  }

  private handleWheel = (event: WheelEvent) => {
    event.stopPropagation();
    const zoomOut = event.deltaY > 0; // Zoom out for positive deltaY, zoom in for negative
    this.zoom(zoomOut);
  };

  private zoom(zoomOut: boolean) {
    const currentRange = Math.abs(this.displayRange.maxCol - this.displayRange.minCol);
    console.log(
      `Zooming ${zoomOut ? "out" : "in"} from ${currentRange}, minCol: ${this.displayRange.minCol}, maxCol: ${
        this.displayRange.maxCol
      }`,
    );
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
    this.displayRange.minCol = this.displayRange.minCol + deltaX;
    this.displayRange.maxCol = this.displayRange.maxCol - deltaX;
    this.displayRange.minRow = this.displayRange.minRow + deltaY;
    this.displayRange.maxRow = this.displayRange.maxRow - deltaY;

    this.recomputeScales();
  }

  handleClick = (event: MouseEvent) => {
    event.stopPropagation();
    const { col, row, x, y } = this.getMousePosition(event);

    const borderWidthX = this.canvas.width * this.BORDER_WIDTH_PERCENT;
    const borderWidthY = this.canvas.height * this.BORDER_WIDTH_PERCENT;

    if (x < borderWidthX) {
      this.moveMapRange("left");
    } else if (x > this.canvas.width - borderWidthX) {
      this.moveMapRange("right");
    } else if (y < borderWidthY) {
      this.moveMapRange("top");
    } else if (y > this.canvas.height - borderWidthY) {
      this.moveMapRange("bottom");
    }
    this.worldmapScene.moveCameraToColRow(col, row, 0);
  };
}

export default Minimap;
