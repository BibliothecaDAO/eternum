import { FELT_CENTER } from "@/ui/config";
import { getHexForWorldPosition } from "@/ui/utils/utils";
import { throttle } from "lodash"; // Import throttle from lodash
import * as THREE from "three";
import WorldmapScene from "../scenes/Worldmap";
import { ArmyManager } from "./ArmyManager"; // Import ArmyManager
import { Biome, BIOME_COLORS } from "./Biome";
import { StructureManager } from "./StructureManager";

class Minimap {
  private worldmapScene: WorldmapScene;
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private camera: THREE.PerspectiveCamera;
  private exploredTiles: Map<number, Set<number>>;
  private structureManager: StructureManager;
  private armyManager: ArmyManager; // Add armyManager
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
  private biomeCache: Map<string, string>; // Add biomeCache

  constructor(
    worldmapScene: WorldmapScene,
    exploredTiles: Map<number, Set<number>>,
    camera: THREE.PerspectiveCamera,
    structureManager: StructureManager,
    armyManager: ArmyManager, // Add armyManager
    biome: Biome,
  ) {
    this.worldmapScene = worldmapScene;
    this.canvas = document.getElementById("minimap") as HTMLCanvasElement;
    this.context = this.canvas.getContext("2d")!;
    this.structureManager = structureManager;
    this.exploredTiles = exploredTiles;
    this.armyManager = armyManager; // Initialize armyManager
    this.biome = biome;
    this.camera = camera;
    this.scaleX = this.canvas.width / (this.displayRange.maxCol - this.displayRange.minCol);
    this.scaleY = this.canvas.height / (this.displayRange.maxRow - this.displayRange.minRow);
    this.biomeCache = new Map(); // Initialize biomeCache

    // Throttle the draw function to 30 FPS
    this.draw = throttle(this.draw.bind(this), 1000 / 30);

    // Add event listener for click event
    this.canvas.addEventListener("click", this.handleClick.bind(this));
    // Add event listeners for dragging
    this.canvas.addEventListener("mousedown", this.handleMouseDown.bind(this));
    this.canvas.addEventListener("mousemove", this.handleMouseMove.bind(this));
    this.canvas.addEventListener("mouseup", this.handleMouseUp.bind(this));
  }

  draw() {
    // Clear the canvas
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw explored tiles
    this.drawExploredTiles();

    // Draw structures
    this.drawStructures();

    // Draw the camera position
    this.drawCamera();

    // Draw armies
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

        const scaledCol = (col - this.displayRange.minCol) * this.scaleX;
        const scaledRow = (row - this.displayRange.minRow) * this.scaleY;
        this.context.fillStyle = biomeColor;
        this.context.fillRect(scaledCol, scaledRow, this.scaleX, this.scaleY);
      });
    });
  }

  private drawStructures() {
    const allStructures = this.structureManager.structures.getStructures();

    for (const [structureType, structures] of allStructures) {
      structures.forEach((structure) => {
        const { col, row } = structure.hexCoords;
        const scaledCol = (col - this.displayRange.minCol) * this.scaleX;
        const scaledRow = (row - this.displayRange.minRow) * this.scaleY;
        this.context.fillStyle = "red";
        this.context.fillRect(scaledCol, scaledRow, 3, 3);
      });
    }
  }

  private drawArmies() {
    const allArmies = this.armyManager.getArmies(); // Use armyManager to get armies

    allArmies.forEach((army) => {
      const { x: col, y: row } = army.hexCoords.getNormalized();
      const scaledCol = (col - this.displayRange.minCol) * this.scaleX;
      const scaledRow = (row - this.displayRange.minRow) * this.scaleY;
      this.context.fillStyle = "blue"; // Color for armies
      this.context.fillRect(scaledCol, scaledRow, 3, 3);
    });
  }

  drawCamera() {
    const cameraPosition = this.camera.position;
    const { col, row } = getHexForWorldPosition(cameraPosition);
    const scaledCol = (col - this.displayRange.minCol) * this.scaleX;
    const scaledRow = (row - this.displayRange.minRow) * this.scaleY;

    // draw a trapezoid
    this.context.fillStyle = "green";
    this.context.beginPath();
    const topSideWidth = (window.innerWidth / 105) * this.scaleX;
    const bottomSideWidth = (window.innerWidth / 170) * this.scaleX;
    const height = 13 * this.scaleY;
    this.context.moveTo(scaledCol - topSideWidth / 2, scaledRow - height);
    this.context.lineTo(scaledCol + topSideWidth / 2, scaledRow - height);
    this.context.lineTo(scaledCol + bottomSideWidth / 2, scaledRow);
    this.context.lineTo(scaledCol - bottomSideWidth / 2, scaledRow);
    this.context.lineTo(scaledCol - topSideWidth / 2, scaledRow - height);
    this.context.closePath();
    this.context.lineWidth = 2;
    this.context.stroke();
  }

  update() {
    this.draw();
  }

  private handleMouseDown(event: MouseEvent) {
    this.isDragging = true;
    this.moveCamera(event);
  }

  private handleMouseMove(event: MouseEvent) {
    if (this.isDragging) {
      this.moveCamera(event);
    }
  }

  private handleMouseUp() {
    this.isDragging = false;
  }

  private moveCamera(event: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const col = Math.floor(x / this.scaleX) + this.displayRange.minCol;
    const row = Math.floor(y / this.scaleY) + this.displayRange.minRow;

    this.worldmapScene.moveCameraToColRow(col, row, 0);
  }

  handleClick(event: MouseEvent) {
    this.moveCamera(event);
  }
}

export default Minimap;
