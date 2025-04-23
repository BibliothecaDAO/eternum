import * as THREE from "three";

const AURA_SIZE = 1.8;
const AURA_OPACITY = 0.8;
const AURA_ROTATION_SPEED = 0.01;
const AURA_RENDER_ORDER = 20;

export class Aura {
  private mesh: THREE.Mesh;

  constructor() {
    this.mesh = this.createAuraMesh();
  }

  private createAuraMesh(): THREE.Mesh {
    const textureLoader = new THREE.TextureLoader();
    const auraTexture = textureLoader.load("/textures/aura2.png");
    const auraMaterial = new THREE.MeshBasicMaterial({
      map: auraTexture,
      transparent: true,
      opacity: AURA_OPACITY,
    });
    const auraGeometry = new THREE.PlaneGeometry(AURA_SIZE, AURA_SIZE);
    const auraMesh = new THREE.Mesh(auraGeometry, auraMaterial);
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
}
