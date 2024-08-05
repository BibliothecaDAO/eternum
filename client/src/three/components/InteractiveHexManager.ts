import * as THREE from "three";
import { createHexagonShape } from "@/ui/components/worldmap/hexagon/HexagonGeometry";
import { interactiveHexMaterial } from "@/three/shaders/borderHexMaterial";
import { getHexagonCoordinates, getWorldPositionForHex } from "@/ui/utils/utils";
import { HEX_SIZE } from "../scenes/HexagonScene";

const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
export class InteractiveHexManager {
  private scene: THREE.Scene;
  private hexes: Set<string> = new Set();
  private instanceMesh: THREE.InstancedMesh | null = null;
  private auraMesh: THREE.Mesh | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.createAuraMesh();
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onDoubleClick = this.onDoubleClick.bind(this);
  }

  private createAuraMesh() {
    const textureLoader = new THREE.TextureLoader();
    const auraTexture = textureLoader.load("/textures/aura.png");
    const auraMaterial = new THREE.MeshBasicMaterial({
      map: auraTexture,
      transparent: true,
      opacity: 0.8,
    });
    const auraGeometry = new THREE.PlaneGeometry(1.8, 1.8);
    this.auraMesh = new THREE.Mesh(auraGeometry, auraMaterial);
    this.auraMesh.rotation.x = -Math.PI / 2;
    this.auraMesh.renderOrder = 1;

    // Add these lines to remove pointer events
    this.auraMesh.receiveShadow = false;
    this.auraMesh.castShadow = false;

    this.auraMesh.raycast = () => {};
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
          intersectedObject.getMatrixAt(instanceId, matrix);

          position.setFromMatrixPosition(matrix);

          if (this.auraMesh) {
            this.auraMesh.position.set(position.x, 0.2, position.z);
            if (!this.scene.children.includes(this.auraMesh)) {
              this.scene.add(this.auraMesh);
            }
          }
          return hoveredHex;
        }
      }
    } else {
      if (this.auraMesh && this.scene.children.includes(this.auraMesh)) {
        this.scene.remove(this.auraMesh);
      }
    }
  }

  public onDoubleClick(raycaster: THREE.Raycaster) {
    if (!this.instanceMesh) return;
    const intersects = raycaster.intersectObjects([this.instanceMesh], true);
    if (intersects.length > 0) {
      const intersect = intersects[0];
      const intersectedObject = intersect.object;
      if (intersectedObject instanceof THREE.InstancedMesh) {
        const instanceId = intersect.instanceId;
        if (instanceId >= 0) {
          return getHexagonCoordinates(intersectedObject, instanceId);
        }
      }
    }
  }

  private rotateAura() {
    if (this.auraMesh) {
      this.auraMesh.rotation.z += 0.01;
    }
  }

  addHex(hex: { col: number; row: number }) {
    this.hexes.add(`${hex.col},${hex.row}`);
  }

  clearHexes() {
    this.hexes.clear();
  }

  renderHexes() {
    // Remove existing instanced mesh if it exists
    if (this.instanceMesh) {
      this.scene.remove(this.instanceMesh);
      this.instanceMesh.dispose();
    }

    // Create new highlight mesh using InstancedMesh
    const bigHexagonShape = createHexagonShape(HEX_SIZE);
    const hexagonGeometry = new THREE.ShapeGeometry(bigHexagonShape);
    const instanceCount = this.hexes.size;
    this.instanceMesh = new THREE.InstancedMesh(hexagonGeometry, interactiveHexMaterial, instanceCount);

    const dummy = new THREE.Object3D();
    let index = 0;
    this.hexes.forEach((hexString) => {
      const [col, row] = hexString.split(",").map(Number);
      const position = getWorldPositionForHex({ col, row });
      dummy.position.set(position.x, 0.1, position.z);
      dummy.rotation.x = -Math.PI / 2;
      dummy.updateMatrix();
      this.instanceMesh!.setMatrixAt(index, dummy.matrix);
      index++;
    });

    this.scene.add(this.instanceMesh);
  }

  update() {
    this.rotateAura();
  }
}
