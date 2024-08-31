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
  private arrowGroup: THREE.Group | null = null;

  constructor(scene: THREE.Scene, controls: MapControls, guiFolder: any) {
    this.scene = scene;
    this.controls = controls;
    this.guiFolder = guiFolder;
    this.createArrowMesh();
    this.updateArrowRotation();
  }

  private createArrowMesh() {
    this.arrowGroup = new THREE.Group();
    const arrowGeometry = new THREE.ConeGeometry(0.25, 0.5, 32);
    const arrowMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    this.arrowMesh = new THREE.Mesh(arrowGeometry, arrowMaterial);
    this.arrowMesh.visible = true;

    this.arrowGroup.position.set(0, 4, 0);
    this.arrowGroup.add(this.arrowMesh);
    this.arrowGroup.rotateX(Math.PI / 2);
    this.scene.add(this.arrowGroup);
  }

  clearNavigationTarget() {
    this.target = null;
    if (this.arrowMesh) {
      this.arrowMesh.visible = false;
    }
  }

  setNavigationTarget(col: number, row: number) {
    this.target = { col, row };
    if (this.arrowMesh) {
      this.arrowMesh.visible = true;
      this.updateArrowRotation();
    }
  }

  private updateArrowRotation() {
    if (!this.arrowMesh || !this.target) return;

    const targetPosition = getWorldPositionForHex(this.target, true);

    // Make the arrow point downwards towards the target

    this.arrowMesh.lookAt(targetPosition);
    this.arrowMesh.rotateX(Math.PI / 2);
  }

  update() {
    this.updateArrowRotation();
  }
}
