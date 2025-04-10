import { gltfLoader } from "@/three/helpers/utils";
import { type HexPosition } from "@bibliothecadao/types";
import throttle from "lodash/throttle";
import * as THREE from "three";
import { CSS2DObject } from "three-stdlib";
import { type MapControls } from "three/examples/jsm/controls/MapControls";
import { calculateDistanceInHexes, getWorldPositionForHex } from "../utils";

const dummyObject = new THREE.Object3D();
const arrowOffset = new THREE.Vector3(0, 3, 0);
export class Navigator {
  private scene: THREE.Scene;
  private controls: MapControls;
  private arrowModel: THREE.Object3D | null = null;
  private target: HexPosition | null = null;
  private guiFolder: any;
  private label: THREE.Group | null = null;
  private distanceDiv: HTMLElement | null = null;

  constructor(scene: THREE.Scene, controls: MapControls, guiFolder: any) {
    this.scene = scene;
    this.controls = controls;
    this.guiFolder = guiFolder;
    this.label = new THREE.Group();
    this.scene.add(this.label);
    this.distanceDiv = document.createElement("div");
    this.distanceDiv.className = "label";
    this.distanceDiv.style.backgroundColor = "transparent";

    const posLabel = new CSS2DObject(this.distanceDiv);
    posLabel.position.set(0, 7.5, 0);
    this.label!.add(posLabel);
    this.loadArrowModel();
  }

  private loadArrowModel() {
    const loader = gltfLoader;
    loader.load("/models/arrow.glb", (gltf) => {
      this.arrowModel = gltf.scene;
      this.arrowModel.scale.set(0.5, 0.5, 0.5);
      this.arrowModel.position.set(0, 8.5, 0);
      this.arrowModel.visible = false;
      this.scene.add(this.arrowModel);
      this.updateArrowRotation();
    });
  }

  clearNavigationTarget() {
    this.target = null;
    if (this.arrowModel) {
      this.arrowModel.visible = false;
      this.distanceDiv!.textContent = "";
    }
  }

  setNavigationTarget(col: number, row: number) {
    this.target = { col, row };
    if (this.arrowModel) {
      this.arrowModel.visible = true;
      this.updateArrowRotation();
    }
  }

  getNavigationTarget() {
    return this.target;
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

  private calculateDistance = throttle(() => {
    if (!this.target) return;

    const targetPosition = getWorldPositionForHex(this.target, true);
    const controlsTargetPosition = this.controls.target;
    const distance = calculateDistanceInHexes(
      {
        x: controlsTargetPosition.x,
        y: controlsTargetPosition.z,
      },
      {
        x: targetPosition.x,
        y: targetPosition.z,
      },
    );
    if (distance) {
      this.distanceDiv!.textContent = `You are ${distance} hex away`;
    } else {
      this.distanceDiv!.textContent = "";
    }
  }, 100);

  update() {
    this.updateArrowRotation();
    this.calculateDistance();
  }
}
