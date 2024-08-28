import { HexPosition } from "@/types";
import { getWorldPositionForHex } from "@/ui/utils/utils";
import * as THREE from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls";

export class Navigator {
  private scene: THREE.Scene;
  private controls: MapControls;
  private arrowMesh: THREE.Mesh | null = null;
  private target: HexPosition | null = null;
  private guiFolder: any;
  private camera: THREE.PerspectiveCamera;
  private visibleAreaSizeX: number = 10;
  private visibleAreaSizeZ: number = 7;

  constructor(scene: THREE.Scene, controls: MapControls, guiFolder: any) {
    this.scene = scene;
    this.controls = controls;
    this.camera = this.controls.object as THREE.PerspectiveCamera;
    this.guiFolder = guiFolder;
    this.createArrowMesh();
  }

  private createArrowMesh() {
    const arrowGeometry = new THREE.ConeGeometry(0.5, 1, 32);
    const arrowMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    this.arrowMesh = new THREE.Mesh(arrowGeometry, arrowMaterial);
    this.arrowMesh.rotation.x = Math.PI / 2;
    this.arrowMesh.visible = true;
    const { x, z } = getWorldPositionForHex({ col: 1, row: 1 });
    this.arrowMesh.position.set(x, 3, z);
    this.scene.add(this.arrowMesh);
    this.guiFolder.add(this, "visibleAreaSizeX", 0, 20);
    this.guiFolder.add(this, "visibleAreaSizeZ", 0, 20);
  }

  setNavigationTarget(col: number, row: number) {
    this.target = { col, row };
    if (this.arrowMesh) {
      this.arrowMesh.visible = true;
      this.updateArrowPosition();
    }
  }

  private updateArrowPosition() {
    if (!this.target || !this.arrowMesh) return;

    const { x, z } = getWorldPositionForHex(this.target);
    const y = 3; // Height above the ground

    // Calculate the visible area bounds with different sizes for X and Z

    const controlsTargetPosition = this.controls.target;
    const bounds = {
      minX: controlsTargetPosition.x - this.visibleAreaSizeX,
      maxX: controlsTargetPosition.x + this.visibleAreaSizeX,
      minZ: controlsTargetPosition.z - this.visibleAreaSizeZ,
      maxZ: controlsTargetPosition.z + this.visibleAreaSizeZ,
    };

    // Clamp the arrow position within the visible area
    const clampedX = Math.max(bounds.minX, Math.min(bounds.maxX, x));
    const clampedZ = Math.max(bounds.minZ, Math.min(bounds.maxZ, z));

    this.arrowMesh.position.set(clampedX, y, clampedZ);
    this.updateArrowRotation();
  }

  private updateArrowRotation() {
    if (!this.arrowMesh || !this.target) return;

    const targetPosition = getWorldPositionForHex(this.target);
    this.arrowMesh.lookAt(targetPosition);
    // Rotate 180 degrees so it points away from the camera
    this.arrowMesh.rotateX(Math.PI / 2);
  }

  update() {
    if (this.target) {
      this.updateArrowPosition();
    }
  }
}
