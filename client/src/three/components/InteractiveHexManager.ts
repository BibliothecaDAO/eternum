import * as THREE from "three";
import { createHexagonShape } from "../geometry/HexagonGeometry";
import { interactiveHexMaterial } from "@/three/shaders/borderHexMaterial";
import { getHexagonCoordinates, getWorldPositionForHex } from "@/ui/utils/utils";
import { HEX_SIZE } from "../scenes/constants";
import { Aura } from "./Aura";

export class InteractiveHexManager {
  private scene: THREE.Scene;
  private hexes: Set<string> = new Set();
  private instanceMesh: THREE.InstancedMesh | null = null;
  private hoverAura: Aura;
  private matrix = new THREE.Matrix4();
  private position = new THREE.Vector3();
  private dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.hoverAura = new Aura();
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onClick = this.onClick.bind(this);
  }

  public onMouseMove(raycaster: THREE.Raycaster) {
    if (!this.instanceMesh) return;
    const intersects = raycaster.intersectObjects([this.instanceMesh], true);
    if (intersects.length > 0) {
      const intersect = intersects[0];
      const intersectedObject = intersect.object;
      if (intersectedObject instanceof THREE.InstancedMesh) {
        const instanceId = intersect.instanceId;
        if (instanceId !== undefined) {
          const hoveredHex = getHexagonCoordinates(intersectedObject, instanceId);
          intersectedObject.getMatrixAt(instanceId, this.matrix);

          this.position.setFromMatrixPosition(this.matrix);

          this.hoverAura.setPosition(this.position.x, 0.2, this.position.z);
          if (!this.hoverAura.isInScene(this.scene)) {
            this.hoverAura.addToScene(this.scene);
          }
          return hoveredHex;
        }
      }
    } else {
      if (this.hoverAura.isInScene(this.scene)) {
        this.hoverAura.removeFromScene(this.scene);
      }
    }
  }

  public onClick(raycaster: THREE.Raycaster) {
    if (!this.instanceMesh) return;
    const intersects = raycaster.intersectObjects([this.instanceMesh], true);
    if (intersects.length > 0) {
      const intersect = intersects[0];
      const intersectedObject = intersect.object;
      if (intersectedObject instanceof THREE.InstancedMesh) {
        const instanceId = intersect.instanceId;
        if (instanceId !== undefined) {
          return getHexagonCoordinates(intersectedObject, instanceId);
        }
      }
    }
  }

  addHex(hex: { col: number; row: number }) {
    this.hexes.add(`${hex.col},${hex.row}`);
  }

  clearHexes() {
    this.hexes.clear();
  }

  renderHexes() {
    if (this.instanceMesh) {
      this.scene.remove(this.instanceMesh);
      this.instanceMesh.dispose();
    }

    const bigHexagonShape = createHexagonShape(HEX_SIZE);
    const hexagonGeometry = new THREE.ShapeGeometry(bigHexagonShape);
    const instanceCount = this.hexes.size;
    this.instanceMesh = new THREE.InstancedMesh(hexagonGeometry, interactiveHexMaterial, instanceCount);

    let index = 0;
    this.hexes.forEach((hexString) => {
      const [col, row] = hexString.split(",").map(Number);
      const position = getWorldPositionForHex({ col, row });
      this.dummy.position.set(position.x, 0.1, position.z);
      this.dummy.rotation.x = -Math.PI / 2;
      this.dummy.updateMatrix();
      this.instanceMesh!.setMatrixAt(index, this.dummy.matrix);
      index++;
    });

    this.scene.add(this.instanceMesh);
  }

  update() {
    this.hoverAura.rotate();
  }
}
