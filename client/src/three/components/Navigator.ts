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
  private arrowOffset: THREE.Vector3;

  constructor(scene: THREE.Scene, controls: MapControls, guiFolder: any) {
    this.scene = scene;
    this.controls = controls;
    this.camera = this.controls.object as THREE.PerspectiveCamera;
    this.guiFolder = guiFolder;
    this.arrowOffset = new THREE.Vector3(0, 5, 0);
    this.createArrowMesh();
    this.updateArrowPosition();
    this.addGuiControls(guiFolder);
  }

  private createArrowMesh() {
    const arrowGeometry = new THREE.ConeGeometry(0.25, 0.5, 32);
    const arrowMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    this.arrowMesh = new THREE.Mesh(arrowGeometry, arrowMaterial);
    this.arrowMesh.rotation.x = Math.PI / 2;
    this.arrowMesh.visible = false;
    const { x, z } = getWorldPositionForHex({ col: 1, row: 1 });
    this.arrowMesh.position.set(x, 2, z);
    this.arrowMesh.renderOrder = 3;
    this.scene.add(this.arrowMesh);
  }

  private addGuiControls(guiFolder: any) {
    const offsetFolder = guiFolder.addFolder("Arrow Offset");
    offsetFolder
      .add(this.arrowOffset, "x", -10, 10, 0.1)
      .name("X Offset")
      .onChange(() => this.updateArrowPosition());
    offsetFolder
      .add(this.arrowOffset, "y", -10, 10, 0.1)
      .name("Y Offset")
      .onChange(() => this.updateArrowPosition());
    offsetFolder
      .add(this.arrowOffset, "z", -10, 10, 0.1)
      .name("Z Offset")
      .onChange(() => this.updateArrowPosition());
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
      this.updateArrowPosition();
    }
  }

  private updateArrowPosition() {
    if (!this.arrowMesh) return;

    const controlsTargetPosition = this.controls.target;
    this.arrowMesh.position.copy(controlsTargetPosition).add(this.arrowOffset);

    this.updateArrowRotation();
  }

  private updateArrowRotation() {
    if (!this.arrowMesh || !this.target) return;

    const targetPosition = getWorldPositionForHex(this.target, true);

    // Make the arrow point downwards towards the target

    this.arrowMesh.lookAt(targetPosition);
    this.arrowMesh.rotateX(Math.PI / 2);
  }

  update() {
    this.updateArrowPosition();
  }
}
