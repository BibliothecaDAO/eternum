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

  constructor(scene: THREE.Scene, controls: MapControls) {
    this.scene = scene;
    this.controls = controls;
    this.camera = this.controls.object as THREE.PerspectiveCamera;
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

    this.arrowMesh.position.set(x, y, z);
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
