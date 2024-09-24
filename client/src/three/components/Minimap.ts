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
    minCol: 0,
    maxCol: 500,
    minRow: 0,
    maxRow: 500,
  };

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
  }

  draw() {
    // Clear the canvas
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Calculate scale factors
    const scaleX = this.canvas.width / (this.displayRange.maxCol - this.displayRange.minCol);
    const scaleY = this.canvas.height / (this.displayRange.maxRow - this.displayRange.minRow);

    // Draw structures
    const allStructures = this.structureManager.structures.getStructures();
    console.log("structures", allStructures);
    for (const [structureType, structures] of allStructures) {
      structures.forEach((structure) => {
        const { col, row } = structure.hexCoords;
        const scaledCol = (col - this.displayRange.minCol) * scaleX;
        const scaledRow = (row - this.displayRange.minRow) * scaleY;
        this.context.fillStyle = "blue";
        this.context.fillRect(scaledCol, scaledRow, 3, 3);
      });
    }

    // Draw the camera position
    const cameraPosition = this.camera.position;
    const { col, row } = getHexForWorldPosition(cameraPosition);
    const scaledCol = (col - this.displayRange.minCol) * scaleX;
    const scaledRow = (row - this.displayRange.minRow) * scaleY;
    this.context.fillStyle = "red";
    this.context.fillRect(scaledCol, scaledRow, 3, 3);
  }

  update() {
    this.draw();
  }
}

export default Minimap;
