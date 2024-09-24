import { getHexForWorldPosition } from "@/ui/utils/utils";
import * as THREE from "three";
import { StructureManager } from "./StructureManager";

class Minimap {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private camera: THREE.PerspectiveCamera;
  private exploredTiles: Map<number, Set<number>>;
  private structureManager: StructureManager;
  private displayRange: any = {
    minCol: 150,
    maxCol: 350,
    minRow: 100,
    maxRow: 200,
  };
  private scaleX: number;
  private scaleY: number;

  constructor(
    exploredTiles: Map<number, Set<number>>,
    camera: THREE.PerspectiveCamera,
    structureManager: StructureManager,
  ) {
    this.canvas = document.getElementById("minimap") as HTMLCanvasElement;
    this.context = this.canvas.getContext("2d")!;
    this.structureManager = structureManager;
    this.exploredTiles = exploredTiles;
    this.camera = camera;
    this.scaleX = this.canvas.width / (this.displayRange.maxCol - this.displayRange.minCol);
    this.scaleY = this.canvas.height / (this.displayRange.maxRow - this.displayRange.minRow);
  }

  draw() {
    // Clear the canvas
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Calculate scale factors

    // Draw structures
    const allStructures = this.structureManager.structures.getStructures();

    for (const [structureType, structures] of allStructures) {
      structures.forEach((structure) => {
        const { col, row } = structure.hexCoords;
        const scaledCol = (col - this.displayRange.minCol) * this.scaleX;
        const scaledRow = (row - this.displayRange.minRow) * this.scaleY;
        this.context.fillStyle = "blue";
        this.context.fillRect(scaledCol, scaledRow, 2, 2);
      });
    }

    // Draw the camera position
    this.drawCamera();
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
}

export default Minimap;
