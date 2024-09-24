import { getHexForWorldPosition } from "@/ui/utils/utils";
import * as THREE from "three";

class Minimap {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private displayRange: any = {
    minCol: 0,
    maxCol: 500,
    minRow: 0,
    maxRow: 500,
  };

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.canvas = document.getElementById("minimap") as HTMLCanvasElement;
    this.context = this.canvas.getContext("2d")!;
    this.scene = scene;
    this.camera = camera;
  }

  draw() {
    // Clear the canvas
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Calculate scale factors
    const scaleX = this.canvas.width / (this.displayRange.maxCol - this.displayRange.minCol);
    const scaleY = this.canvas.height / (this.displayRange.maxRow - this.displayRange.minRow);

    // Draw the scene objects
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const position = object.position;
        const { col, row } = getHexForWorldPosition(position);
        if (col == 185 && row == 150) {
          console.log("object", object);
        }

        if (
          col >= this.displayRange.minCol &&
          col <= this.displayRange.maxCol &&
          row >= this.displayRange.minRow &&
          row <= this.displayRange.maxRow
        ) {
          const scaledCol = (col - this.displayRange.minCol) * scaleX;
          const scaledRow = (row - this.displayRange.minRow) * scaleY;
          this.context.fillStyle = "white";
          this.context.fillRect(scaledCol, scaledRow, 1, 1);
        }
      }
    });

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
