import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { AnimationMixer } from "three";
export class Character {
  private model!: THREE.Object3D;

  private mesh: THREE.Mesh;

  private selected: boolean = false;

  private currentHexPosition: { row: number; col: number };

  private targetPosition: THREE.Vector3;
  private isMoving: boolean = false;
  private moveSpeed: number = 2;

  private mixer!: AnimationMixer;
  private walkAction!: THREE.AnimationAction;

  constructor(scene: THREE.Scene, initialPosition: { row: number; col: number }) {
    this.currentHexPosition = initialPosition;

    // Create a simple character mesh (you can replace this with a more complex model later)
    const geometry = new THREE.ConeGeometry(0.4, 2, 32);
    const material = new THREE.MeshPhongMaterial({ color: 0xff0000 });
    this.mesh = new THREE.Mesh(geometry, material);

    const loader = new GLTFLoader();
    loader.load(
      "models/dark_knight.glb",
      (gltf) => {
        this.model = gltf.scene.clone();
        this.model.scale.set(0.005, 0.005, 0.005); // Adjust scale as needed
        this.updatePosition();
        scene.add(this.model);

        // Set up animation
        this.mixer = new AnimationMixer(this.model);
        const animations = gltf.animations;
        if (animations && animations.length > 0) {
          this.walkAction = this.mixer.clipAction(animations[0]);
          this.walkAction.play();
          this.walkAction.paused = true; // Start paused
        }
      },
      undefined,
      (error) => {
        console.error("An error occurred while loading the model:", error);
      },
    );

    // Set initial position
    this.targetPosition = new THREE.Vector3();
  }

  moveToHex(newPosition: { row: number; col: number }) {
    const oldPosition = this.currentHexPosition;
    this.currentHexPosition = newPosition;
    this.calculateTargetPosition();
    this.isMoving = true;
    if (this.walkAction) {
      this.walkAction.paused = false; // Start walking animation
    }
    this.rotateTowardsTarget(oldPosition, newPosition);
  }
  toggleSelect() {
    this.selected = !this.selected;
    if (this.model) {
      const mesh = this.model.children[0] as THREE.Mesh;
      if (mesh.isMesh) {
        const material = mesh.material as THREE.MeshStandardMaterial;
        if (this.selected) {
          material.emissive.setHex(0xff0000); // Set to red when selected
        } else {
          material.emissive.setHex(0x000000); // Reset to default when deselected
        }
      }
    }
  }

  isSelected(): boolean {
    return this.selected;
  }

  getWorldPosition(): THREE.Vector3 {
    if (this.model) {
      const position = this.model.position;
      this.model.getWorldPosition(position);
      return position;
    }
    return new THREE.Vector3();
  }

  private rotateTowardsTarget(oldPos: { row: number; col: number }, newPos: { row: number; col: number }) {
    if (!this.model) return;

    const dx = newPos.col - oldPos.col + ((newPos.row % 2) - (oldPos.row % 2)) * 0.5;
    const dy = newPos.row - oldPos.row;

    const angle = Math.atan2(dy, dx);

    this.model.rotation.y = angle + Math.PI / 2;
  }

  private calculateTargetPosition() {
    const { row, col } = this.currentHexPosition;
    const hexSize = 1;
    const horizontalSpacing = hexSize * Math.sqrt(3);
    const verticalSpacing = (hexSize * 3) / 2;

    this.targetPosition.x = col * horizontalSpacing + (row % 2) * (horizontalSpacing / 2);
    this.targetPosition.z = -row * verticalSpacing;
    this.targetPosition.y = 0.5;
  }

  update(deltaTime: number) {
    if (this.isMoving && this.model) {
      const t = Math.min(1, this.moveSpeed * deltaTime);
      this.model.position.lerp(this.targetPosition, t);

      if (this.model.position.distanceTo(this.targetPosition) < 0.01) {
        this.isMoving = false;
        this.model.position.copy(this.targetPosition);
        if (this.walkAction) {
          this.walkAction.paused = true; // Stop walking animation
        }
      }

      // Update mixer for animation
      if (this.mixer) {
        this.mixer.update(deltaTime);
      }
    }
  }

  private updatePosition() {
    if (!this.model) return;

    const { row, col } = this.currentHexPosition;
    const hexSize = 1; // Make sure this matches the hexSize in HexagonMap
    const horizontalSpacing = hexSize * Math.sqrt(3);
    const verticalSpacing = (hexSize * 3) / 2;

    this.model.position.x = col * horizontalSpacing + (row % 2) * (horizontalSpacing / 2);
    this.model.position.z = -row * verticalSpacing;
    this.model.position.y = 0; // Adjust this value to place the character on top of the hexagons
  }

  getPosition(): { row: number; col: number } {
    return this.currentHexPosition;
  }

  isValidHexPosition(position: { row: number; col: number }): boolean {
    // Implement logic to check if the new position is valid (e.g., not water, within map bounds)
    // For now, we'll just return true
    return true;
  }
}
