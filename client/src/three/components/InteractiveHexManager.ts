import * as THREE from "three";
import { createHexagonShape } from "@/ui/components/worldmap/hexagon/HexagonGeometry";
import WorldmapScene from "../scenes/Worldmap";
import { borderHexMaterial } from "@/three/shaders/borderHexMaterial";
import { transparentHexMaterial } from "@/three/shaders/transparentHexMaterial";
import { HEX_SIZE } from "../GameRenderer";
import { getWorldPositionForHex } from "@/ui/utils/utils";

const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
export class InteractiveHexManager {
  private scene: THREE.Scene;
  private borderHexes: Set<string> = new Set();
  private exploredHexes: Set<string> = new Set();
  private borderInstanceMesh: THREE.InstancedMesh | null = null;
  private exploredInstanceMesh: THREE.InstancedMesh | null = null;
  private auraMesh: THREE.Mesh | null = null;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private camera: THREE.Camera;

  constructor(scene: THREE.Scene, raycaster: THREE.Raycaster, mouse: THREE.Vector2, camera: THREE.Camera) {
    this.scene = scene;
    this.raycaster = raycaster;
    this.mouse = mouse;
    this.camera = camera;
    this.createAuraMesh();
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

  private updateAuraPosition() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    if (intersects.length > 0) {
      const intersect = intersects[0];
      const intersectedObject = intersect.object;
      if (intersectedObject instanceof THREE.InstancedMesh) {
        const instanceId = intersect.instanceId;
        if (instanceId !== undefined) {
          intersectedObject.getMatrixAt(instanceId, matrix);

          position.setFromMatrixPosition(matrix);

          if (this.auraMesh) {
            this.auraMesh.position.set(position.x, 0.2, position.z);
            if (!this.scene.children.includes(this.auraMesh)) {
              this.scene.add(this.auraMesh);
            }
          }
        }
      }
    } else {
      if (this.auraMesh && this.scene.children.includes(this.auraMesh)) {
        this.scene.remove(this.auraMesh);
      }
    }
  }

  private rotateAura() {
    if (this.auraMesh) {
      this.auraMesh.rotation.z += 0.01;
    }
  }

  addBorderHex(hex: { col: number; row: number }) {
    this.borderHexes.add(`${hex.col},${hex.row}`);
  }

  addExploredHex(hex: { col: number; row: number }) {
    // Fixed typo in method name
    this.exploredHexes.add(`${hex.col},${hex.row}`);
  }

  clearHexes() {
    this.borderHexes.clear();
    this.exploredHexes.clear();
  }

  renderHexes() {
    // Remove existing instanced mesh if it exists
    if (this.borderInstanceMesh) {
      this.scene.remove(this.borderInstanceMesh);
      this.borderInstanceMesh.dispose();
    }

    if (this.exploredInstanceMesh) {
      this.scene.remove(this.exploredInstanceMesh);
      this.exploredInstanceMesh.dispose();
    }

    // Create new highlight meshes using InstancedMesh
    const bigHexagonShape = createHexagonShape(HEX_SIZE);
    const hexagonGeometry = new THREE.ShapeGeometry(bigHexagonShape);
    const borderInstanceCount = this.borderHexes.size;
    const exploredInstanceCount = this.exploredHexes.size;
    this.borderInstanceMesh = new THREE.InstancedMesh(hexagonGeometry, borderHexMaterial, borderInstanceCount);
    this.exploredInstanceMesh = new THREE.InstancedMesh(hexagonGeometry, transparentHexMaterial, exploredInstanceCount);

    // Add user data to specify the type of hex
    this.borderInstanceMesh.userData = { type: "border" };
    this.exploredInstanceMesh.userData = { type: "explored" };

    const dummy = new THREE.Object3D();
    let index = 0;
    this.borderHexes.forEach((hexString) => {
      const [col, row] = hexString.split(",").map(Number);
      const position = getWorldPositionForHex({ col, row });
      dummy.position.set(position.x, 0.1, position.z);
      dummy.rotation.x = -Math.PI / 2;
      dummy.updateMatrix();
      this.borderInstanceMesh!.setMatrixAt(index, dummy.matrix);
      index++;
    });

    index = 0; // Reset index for explored hexes
    this.exploredHexes.forEach((hexString) => {
      const [col, row] = hexString.split(",").map(Number);
      const position = getWorldPositionForHex({ col, row });
      dummy.position.set(position.x, 0.1, position.z);
      dummy.rotation.x = -Math.PI / 2;
      dummy.updateMatrix();
      this.exploredInstanceMesh!.setMatrixAt(index, dummy.matrix);
      index++;
    });

    this.scene.add(this.borderInstanceMesh);
    this.scene.add(this.exploredInstanceMesh);
  }

  update() {
    this.rotateAura();
    this.updateAuraPosition();
  }
}
