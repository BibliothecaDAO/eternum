import * as THREE from "three";
import { createHexagonShape } from "../geometry/HexagonGeometry";
import { interactiveHexMaterial } from "@/three/shaders/borderHexMaterial";
import { getHexagonCoordinates, getWorldPositionForHex } from "@/ui/utils/utils";
import { HEX_SIZE } from "../scenes/constants";

const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
export class InteractiveHexManager {
  private scene: THREE.Scene;
  private hexes: Set<string> = new Set();
  private instanceMesh: THREE.InstancedMesh | null = null;
  private auraMesh: THREE.Mesh | null = null;
  private clickAuraMesh: THREE.Mesh | null = null;
  private particles: Particles;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.auraMesh = this.createAuraMesh();
    this.clickAuraMesh = this.createAuraMesh();
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onDoubleClick = this.onDoubleClick.bind(this);
    this.onClick = this.onClick.bind(this);
    this.particles = new Particles(scene);
    this.particles.setParticleSize(0.2); // Set particle size to 2
    this.particles.setLightIntensity(5); // Se
  }

  private createAuraMesh(): THREE.Mesh {
    const textureLoader = new THREE.TextureLoader();
    const auraTexture = textureLoader.load("/textures/aura.png");
    const auraMaterial = new THREE.MeshBasicMaterial({
      map: auraTexture,
      transparent: true,
      opacity: 0.8,
    });
    const auraGeometry = new THREE.PlaneGeometry(1.8, 1.8);
    const auraMesh = new THREE.Mesh(auraGeometry, auraMaterial);
    auraMesh.rotation.x = -Math.PI / 2;
    auraMesh.renderOrder = 1;

    // Add these lines to remove pointer events
    auraMesh.receiveShadow = false;
    auraMesh.castShadow = false;

    auraMesh.raycast = () => {};

    return auraMesh;
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
        if (instanceId !== undefined) {
          return getHexagonCoordinates(intersectedObject, instanceId);
        }
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
          const clickedHex = getHexagonCoordinates(intersectedObject, instanceId);
          this.particles.setPosition(clickedHex.position.x, 0.1, clickedHex.position.z);
          if (this.clickAuraMesh) {
            this.clickAuraMesh.position.set(clickedHex.position.x, 0.19, clickedHex.position.z);
            if (!this.scene.children.includes(this.clickAuraMesh)) {
              this.scene.add(this.clickAuraMesh);
            }
          }
          return clickedHex;
        }
      }
    }
  }

  private rotateAura() {
    if (this.auraMesh) {
      this.auraMesh.rotation.z += 0.01;
    }
    if (this.clickAuraMesh) {
      this.clickAuraMesh.rotation.z += 0.01;
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
    this.particles.update(0.01);
  }
}

const PARTICLES_COUNT = 30;
const PARTICLE_SPEED = 10;
const PARTICLE_RESET_Y = 2.5;
const PARTICLE_START_Y = -2.5;
const LIGHT_COLOR = new THREE.Color(2, 2, 1);
const PARICLE_COLOR = new THREE.Color(15, 12, 2);

// Add these constants for particle position ranges
const PARTICLE_X_RANGE = 1;
const PARTICLE_Y_RANGE = 5;
const PARTICLE_Z_RANGE = 1;

const LIGHT_INTENSITY = 10;

export class Particles {
  private pointsPositions: Float32Array;
  private points: THREE.Points;
  private light: THREE.PointLight;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.pointsPositions = new Float32Array(PARTICLES_COUNT * 3);
    for (let i = 0; i < PARTICLES_COUNT; i++) {
      this.pointsPositions[i * 3] = Math.random() * PARTICLE_X_RANGE - PARTICLE_X_RANGE / 2; // x
      this.pointsPositions[i * 3 + 1] = Math.random() * PARTICLE_Y_RANGE - PARTICLE_Y_RANGE / 2; // y
      this.pointsPositions[i * 3 + 2] = Math.random() * PARTICLE_Z_RANGE - PARTICLE_Z_RANGE / 2; // z
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.pointsPositions, 3));

    const material = new THREE.PointsMaterial({ color: PARICLE_COLOR, size: 1 });

    this.points = new THREE.Points(geometry, material);

    this.light = new THREE.PointLight(LIGHT_COLOR, LIGHT_INTENSITY);

    this.scene = scene;
  }

  setPosition(x: number, y: number, z: number) {
    this.points.position.set(x, y, z);
    this.light.position.set(x, y + 1.5, z);

    // Add the points and light to the scene only when the position is set
    if (!this.scene.children.includes(this.points)) {
      this.scene.add(this.points);
    }
    if (!this.scene.children.includes(this.light)) {
      this.scene.add(this.light);
    }
  }

  setParticleSize(size: number) {
    const material = this.points.material as THREE.PointsMaterial;
    material.size = size;
    material.needsUpdate = true;
  }

  setLightIntensity(intensity: number) {
    this.light.intensity = intensity;
  }

  update(delta: number) {
    for (let i = 0; i < PARTICLES_COUNT; i++) {
      this.pointsPositions[i * 3 + 1] += PARTICLE_SPEED * delta;
      if (this.pointsPositions[i * 3 + 1] > PARTICLE_RESET_Y) {
        this.pointsPositions[i * 3 + 1] = PARTICLE_START_Y;
      }
    }

    this.points.geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.pointsPositions, 3));
  }
}
