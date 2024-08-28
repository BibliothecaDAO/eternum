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
  private visibleAreaWidth: number = 0;
  private visibleAreaHeight: number = 0;

  constructor(scene: THREE.Scene, controls: MapControls, guiFolder: any) {
    this.scene = scene;
    this.controls = controls;
    this.camera = this.controls.object as THREE.PerspectiveCamera;
    this.guiFolder = guiFolder;
    this.createArrowMesh();
    this.updateVisibleArea();
  }

  private createArrowMesh() {
    const arrowGeometry = new THREE.ConeGeometry(0.5, 1, 32);
    const arrowMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    this.arrowMesh = new THREE.Mesh(arrowGeometry, arrowMaterial);
    this.arrowMesh.rotation.x = Math.PI / 2;
    this.arrowMesh.visible = true;
    const { x, z } = getWorldPositionForHex({ col: 1, row: 1 });
    this.arrowMesh.position.set(x, 2, z);
    this.scene.add(this.arrowMesh);
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
    const y = 2; // Height above the ground

    this.updateVisibleArea();

    const controlsTargetPosition = this.controls.target;
    const bounds = {
      minX: controlsTargetPosition.x - this.visibleAreaWidth / 2,
      maxX: controlsTargetPosition.x + this.visibleAreaWidth / 2,
      minZ: controlsTargetPosition.z - this.visibleAreaHeight / 2,
      maxZ: controlsTargetPosition.z + this.visibleAreaHeight / 2,
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

  private updateVisibleArea() {
    const distance = this.controls.target.distanceTo(this.camera.position);
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    this.visibleAreaHeight = 2 * Math.tan(vFov / 2) * distance;
    this.visibleAreaWidth = this.visibleAreaHeight * this.camera.aspect;
  }

  update() {
    if (this.target) {
      this.updateArrowPosition();
    }
  }
}
