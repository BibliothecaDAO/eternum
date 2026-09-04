import * as THREE from "three";

const AURA_SIZE = 1.8;
const AURA_OPACITY = 0.8;
const AURA_ROTATION_SPEED = 0.01;
const AURA_RENDER_ORDER = 20;

// Shared resources across all Aura instances to prevent memory leaks
let sharedAuraTexture: THREE.Texture | null = null;
let sharedAuraMaterial: THREE.MeshBasicMaterial | null = null;
let sharedAuraGeometry: THREE.PlaneGeometry | null = null;
let auraInstanceCount = 0;

function getSharedResources(): {
  geometry: THREE.PlaneGeometry;
  material: THREE.MeshBasicMaterial;
} {
  if (!sharedAuraGeometry) {
    sharedAuraGeometry = new THREE.PlaneGeometry(AURA_SIZE, AURA_SIZE);
  }

  if (!sharedAuraTexture) {
    const textureLoader = new THREE.TextureLoader();
    sharedAuraTexture = textureLoader.load("/textures/aura2.png");
  }

  if (!sharedAuraMaterial) {
    sharedAuraMaterial = new THREE.MeshBasicMaterial({
      map: sharedAuraTexture,
      transparent: true,
      opacity: AURA_OPACITY,
    });
  }

  return {
    geometry: sharedAuraGeometry,
    material: sharedAuraMaterial,
  };
}

export class Aura {
  private mesh: THREE.Mesh;

  constructor() {
    auraInstanceCount++;
    this.mesh = this.createAuraMesh();
  }

  private createAuraMesh(): THREE.Mesh {
    const { geometry, material } = getSharedResources();

    // Use shared geometry and material
    const auraMesh = new THREE.Mesh(geometry, material);
    auraMesh.rotation.x = -Math.PI / 2;
    auraMesh.renderOrder = AURA_RENDER_ORDER;

    auraMesh.receiveShadow = false;
    auraMesh.castShadow = false;
    auraMesh.raycast = () => {};

    return auraMesh;
  }

  setPosition(x: number, y: number, z: number) {
    this.mesh.position.set(x, y, z);
  }

  resetPosition() {
    this.mesh.position.set(0, 0, 0);
  }

  rotate() {
    this.mesh.rotation.z += AURA_ROTATION_SPEED;
  }

  addToScene(scene: THREE.Scene) {
    scene.add(this.mesh);
  }

  removeFromScene(scene: THREE.Scene) {
    scene.remove(this.mesh);
  }

  public setRenderOrder(order: number) {
    this.mesh.renderOrder = order;
  }

  isInScene(scene: THREE.Scene): boolean {
    return scene.children.includes(this.mesh);
  }

  /**
   * Dispose of this Aura instance.
   * Only disposes shared resources when the last instance is disposed.
   */
  dispose(): void {
    // Prevent count from going negative (guard against double-dispose)
    if (auraInstanceCount <= 0) {
      return;
    }

    auraInstanceCount--;

    // Only dispose shared resources when no instances remain
    if (auraInstanceCount === 0) {
      if (sharedAuraGeometry) {
        sharedAuraGeometry.dispose();
        sharedAuraGeometry = null;
      }
      if (sharedAuraMaterial) {
        sharedAuraMaterial.dispose();
        sharedAuraMaterial = null;
      }
      if (sharedAuraTexture) {
        sharedAuraTexture.dispose();
        sharedAuraTexture = null;
      }
    }
  }
}
