import { HexPosition } from "@/types";
import { getWorldPositionForHex } from "@/ui/utils/utils";
import * as THREE from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

const dummyObject = new THREE.Object3D();
const arrowOffset = new THREE.Vector3(0, 3, 0);
export class Navigator {
  private scene: THREE.Scene;
  private controls: MapControls;
  private arrowModel: THREE.Object3D | null = null;
  private target: HexPosition | null = null;
  private guiFolder: any;
  private arrowGroup: THREE.Group | null = null;

  constructor(scene: THREE.Scene, controls: MapControls, guiFolder: any) {
    this.scene = scene;
    this.controls = controls;
    this.guiFolder = guiFolder;
    this.loadArrowModel();
  }

  private loadArrowModel() {
    const loader = new GLTFLoader();
    loader.load("/models/arrow.glb", (gltf) => {
      this.arrowModel = gltf.scene;
      this.arrowGroup = new THREE.Group();
      this.arrowGroup.add(this.arrowModel);
      this.arrowGroup.position.set(0, 8, 0);
      const arrowFolder = this.guiFolder.addFolder("Arrow Controls");
      arrowFolder.add(this.arrowGroup.rotation, "x", 0, Math.PI * 2).name("Rotate X");
      arrowFolder.add(this.arrowGroup.rotation, "y", 0, Math.PI * 2).name("Rotate Y");
      arrowFolder.add(this.arrowGroup.rotation, "z", 0, Math.PI * 2).name("Rotate Z");
      this.scene.add(this.arrowGroup);
      this.updateArrowRotation();
    });
  }

  clearNavigationTarget() {
    this.target = null;
    if (this.arrowGroup) {
      this.arrowGroup.visible = false;
    }
  }

  setNavigationTarget(col: number, row: number) {
    this.target = { col, row };
    if (this.arrowGroup) {
      this.arrowGroup.visible = true;
      this.updateArrowRotation();
    }
  }

  private updateArrowRotation() {
    if (!this.arrowModel || !this.target) return;

    const targetPosition = getWorldPositionForHex(this.target, true);

    const controlsTargetPosition = this.controls.target;
    dummyObject.position.copy(controlsTargetPosition).add(arrowOffset);

    dummyObject.lookAt(targetPosition);
    dummyObject.rotateX(Math.PI);

    this.arrowModel.rotation.copy(dummyObject.rotation);
  }

  update() {
    this.updateArrowRotation();
  }
}
