import { gltfLoader } from "@/three/utils/utils";
import { type HexPosition } from "@bibliothecadao/types";
import throttle from "lodash/throttle";
import * as THREE from "three";
import { CSS2DObject } from "three-stdlib";
import { type MapControls } from "three/examples/jsm/controls/MapControls.js";
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
    this.distanceDiv.style.color = "white";
    this.distanceDiv.style.padding = "5px 10px";
    this.distanceDiv.style.borderRadius = "4px";
    this.distanceDiv.style.fontWeight = "bold";

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
      this.distanceDiv!.style.backgroundColor = "transparent";
    }
  }

  setNavigationTarget(col: number, row: number) {
    this.target = { col, row };
    if (this.arrowModel) {
      this.arrowModel.visible = true;
      this.distanceDiv!.style.backgroundColor = "rgba(0, 0, 0, 0.6)";
      this.updateArrowRotation();
    }
  }

  getNavigationTarget() {
    return this.target;
  }

  public hasActiveLabel(): boolean {
    return this.target !== null;
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
      this.distanceDiv!.textContent = "You are at the target!";
    }
  }, 100);

  update() {
    this.updateArrowRotation();
    this.calculateDistance();
  }

  public dispose(): void {
    console.log("🧹 Navigator: Starting disposal");

    // Clear navigation target
    this.clearNavigationTarget();

    // Remove and dispose arrow model
    if (this.arrowModel) {
      if (this.arrowModel.parent) {
        this.arrowModel.parent.remove(this.arrowModel);
      }

      // Dispose all geometries and materials in the arrow model
      this.arrowModel.traverse((child: any) => {
        if (child.isMesh) {
          if (child.geometry) {
            child.geometry.dispose();
          }
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat: any) => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });

      this.arrowModel = null;
    }

    // Remove label from scene
    if (this.label && this.label.parent) {
      this.label.parent.remove(this.label);
    }

    // Clean up DOM element
    if (this.distanceDiv && this.distanceDiv.parentNode) {
      this.distanceDiv.parentNode.removeChild(this.distanceDiv);
      this.distanceDiv = null;
    }

    // Clear label reference
    this.label = null;

    console.log("🧹 Navigator: Disposed arrow model, label, and DOM elements");
  }
}
