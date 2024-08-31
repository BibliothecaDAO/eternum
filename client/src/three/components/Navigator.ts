import { HexPosition } from "@/types";
import { getWorldPositionForHex } from "@/ui/utils/utils";
import * as THREE from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls";

const dummyObject = new THREE.Object3D();
const arrowHeight = { value: 5 };
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
    this.arrowGroup.rotateX(Math.PI);
    this.arrowGroup.add(this.arrowMesh);
    this.guiFolder.add(this.arrowGroup.rotation, "x", -Math.PI, Math.PI).name("Arrow Rotation X");
    this.guiFolder.add(this.arrowGroup.rotation, "y", -Math.PI, Math.PI).name("Arrow Rotation Y");
    this.guiFolder.add(this.arrowGroup.rotation, "z", -Math.PI, Math.PI).name("Arrow Rotation Z");
    this.guiFolder.add(arrowHeight, "value", 0, 10).name("Arrow Height");
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
    dummyObject.position.copy(this.controls.target);
    dummyObject.position.y += arrowHeight.value;
    dummyObject.lookAt(targetPosition);
    this.arrowMesh.quaternion.copy(dummyObject.quaternion);
  }

  update() {
    this.updateArrowRotation();
  }
}
