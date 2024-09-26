import { FELT_CENTER } from "@/ui/config";
import { getHexForWorldPosition } from "@/ui/utils/utils";
import { throttle } from "lodash";
import * as THREE from "three";
import WorldmapScene from "../scenes/Worldmap";
import { ArmyManager } from "./ArmyManager";
import { Biome, BIOME_COLORS } from "./Biome";
import { StructureManager } from "./StructureManager";

const MINIMAP_CONFIG = {
  MAP_COLS_WIDTH: 200,
  MAP_ROWS_HEIGHT: 100,
  COLORS: {
    ARMY: "#0000FF",
    STRUCTURE: "#FF0000",
    CAMERA: "#008000",
  },
  SIZES: {
    STRUCTURE: 3,
    ARMY: 3,
    CAMERA: {
      TOP_SIDE_WIDTH_FACTOR: 105,
      BOTTOM_SIDE_WIDTH_FACTOR: 170,
      HEIGHT_FACTOR: 13,
    },
  },
  BORDER_WIDTH_PERCENT: 0.10,
};

class Minimap {
  private worldmapScene: WorldmapScene;
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private camera: THREE.PerspectiveCamera;
  private exploredTiles: Map<number, Set<number>>;
  private structureManager: StructureManager;
  private armyManager: ArmyManager;
  private biome: Biome;
  private displayRange: any = {
    minCol: 150,
    maxCol: 350,
    minRow: 100,
    maxRow: 200,
  };
  private scaleX: number;
  private scaleY: number;
  private isDragging: boolean = false;
  private biomeCache: Map<string, string>;
  private scaledCoords: Map<string, { scaledCol: number, scaledRow: number }>;
  private BORDER_WIDTH_PERCENT = MINIMAP_CONFIG.BORDER_WIDTH_PERCENT;

  constructor(
    worldmapScene: WorldmapScene,
    exploredTiles: Map<number, Set<number>>,
    camera: THREE.PerspectiveCamera,
    structureManager: StructureManager,
    armyManager: ArmyManager,
    biome: Biome,
  ) {
    this.worldmapScene = worldmapScene;
    this.canvas = document.getElementById("minimap") as HTMLCanvasElement;
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
    this.computeScaledCoords();

    this.draw = throttle(this.draw, 1000 / 30);

    this.canvas.addEventListener("click", this.handleClick);
    this.canvas.addEventListener("mousedown", this.handleMouseDown);
    this.canvas.addEventListener("mousemove", this.handleMouseMove);
    this.canvas.addEventListener("mouseup", this.handleMouseUp);
  }

  private computeScaledCoords() {
    this.scaledCoords.clear();
    for (let col = this.displayRange.minCol; col <= this.displayRange.maxCol; col++) {
      for (let row = this.displayRange.minRow; row <= this.displayRange.maxRow; row++) {
        const scaledCol = (col - this.displayRange.minCol) * this.scaleX;
        const scaledRow = (row - this.displayRange.minRow) * this.scaleY;
        this.scaledCoords.set(`${col},${row}`, { scaledCol, scaledRow });
      }
    }
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
    this.drawCamera();
    this.drawArmies();
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
          this.context.fillRect(scaledCol, scaledRow, this.scaleX, this.scaleY);
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
          this.context.fillStyle = MINIMAP_CONFIG.COLORS.STRUCTURE;
          this.context.fillRect(scaledCol, scaledRow, MINIMAP_CONFIG.SIZES.STRUCTURE, MINIMAP_CONFIG.SIZES.STRUCTURE);
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
        this.context.fillStyle = MINIMAP_CONFIG.COLORS.ARMY;
        this.context.fillRect(scaledCol, scaledRow, MINIMAP_CONFIG.SIZES.ARMY, MINIMAP_CONFIG.SIZES.ARMY);
      }
    });
  }

  drawCamera() {
    const cameraPosition = this.camera.position;
    const { col, row } = getHexForWorldPosition(cameraPosition);
    const cacheKey = `${col},${row}`;
    if (this.scaledCoords.has(cacheKey)) {
      const { scaledCol, scaledRow } = this.scaledCoords.get(cacheKey)!;

      this.context.fillStyle = MINIMAP_CONFIG.COLORS.CAMERA;
      this.context.beginPath();
      const topSideWidth = (window.innerWidth / MINIMAP_CONFIG.SIZES.CAMERA.TOP_SIDE_WIDTH_FACTOR) * this.scaleX;
      const bottomSideWidth = (window.innerWidth / MINIMAP_CONFIG.SIZES.CAMERA.BOTTOM_SIDE_WIDTH_FACTOR) * this.scaleX;
      const height = MINIMAP_CONFIG.SIZES.CAMERA.HEIGHT_FACTOR * this.scaleY;
      this.context.moveTo(scaledCol - topSideWidth / 2, scaledRow - height);
      this.context.lineTo(scaledCol + topSideWidth / 2, scaledRow - height);
      this.context.lineTo(scaledCol + bottomSideWidth / 2, scaledRow);
      this.context.lineTo(scaledCol - bottomSideWidth / 2, scaledRow);
      this.context.lineTo(scaledCol - topSideWidth / 2, scaledRow - height);
      this.context.closePath();
      this.context.lineWidth = 2;
      this.context.stroke();
    }
  }

  update() {
    this.draw();
  }

  private handleMouseDown = (event: MouseEvent) => {
    this.isDragging = true;
    this.moveCamera(event);
  }

  private handleMouseMove = (event: MouseEvent) => {
    if (this.isDragging) {
      this.moveCamera(event);
    }
  }

  private handleMouseUp = () => {
    this.isDragging = false;
  }

  private moveCamera(event: MouseEvent) {
    const { col, row } = this.getMousePosition(event);
    this.worldmapScene.moveCameraToColRow(col, row, 0);
  }

  private moveMapRange(direction: string) {
    const colShift = (this.displayRange.maxCol - this.displayRange.minCol) / 4;
    const rowShift = (this.displayRange.maxRow - this.displayRange.minRow) / 4;

    switch (direction) {
      case 'left':
        this.displayRange.minCol -= colShift;
        this.displayRange.maxCol -= colShift;
        break;
      case 'right':
        this.displayRange.minCol += colShift;
        this.displayRange.maxCol += colShift;
        break;
      case 'top':
        this.displayRange.minRow -= rowShift;
        this.displayRange.maxRow -= rowShift;
        break;
      case 'bottom':
        this.displayRange.minRow += rowShift;
        this.displayRange.maxRow += rowShift;
        break;
      default:
        return;
    }

    this.scaleX = this.canvas.width / (this.displayRange.maxCol - this.displayRange.minCol);
    this.scaleY = this.canvas.height / (this.displayRange.maxRow - this.displayRange.minRow);
    this.computeScaledCoords();
  }

  handleClick = (event: MouseEvent) => {
    const { col, row, x, y } = this.getMousePosition(event);

    const borderWidthX = this.canvas.width * this.BORDER_WIDTH_PERCENT;
    const borderWidthY = this.canvas.height * this.BORDER_WIDTH_PERCENT;

    if (x < borderWidthX) {
      this.moveMapRange('left');
    } else if (x > this.canvas.width - borderWidthX) {
      this.moveMapRange('right');
    } else if (y < borderWidthY) {
      this.moveMapRange('top');
    } else if (y > this.canvas.height - borderWidthY) {
      this.moveMapRange('bottom');
    }
    this.worldmapScene.moveCameraToColRow(col, row, 0);
  }
}

export default Minimap;
