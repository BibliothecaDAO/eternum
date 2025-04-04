import * as THREE from "three";

export class QuestModel {
  private scene: THREE.Scene;
  private instancedMesh: THREE.InstancedMesh;
  private dummy: THREE.Object3D;
  private maxInstances: number = 100;
  private visibleCount: number = 0;
  private entityToIndex: Map<number, number> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.dummy = new THREE.Object3D();
    // Create a simple geometry for quests (a floating beacon/marker)
    const geometry = new THREE.CylinderGeometry(0.5, 0.1, 2, 8);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      emissive: 0xffcc00,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.8,
    });

    // Create instanced mesh
    this.instancedMesh = new THREE.InstancedMesh(geometry, material, this.maxInstances);
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.instancedMesh.castShadow = true;
    this.instancedMesh.receiveShadow = true;

    // Add to scene
    this.scene.add(this.instancedMesh);

    // Add a pulsing animation
    this.animate();
  }

  private animate() {
    // Create a subtle pulsing animation
    const pulseSpeed = 1.5;
    const pulseIntensity = 0.3;

    const animate = () => {
      const time = Date.now() * 0.001;
      const pulse = Math.sin(time * pulseSpeed) * pulseIntensity + 1;

      // Apply pulse to scale
      for (let i = 0; i < this.visibleCount; i++) {
        this.dummy.scale.set(pulse, pulse, pulse);
        this.dummy.updateMatrix();
        this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
      }

      if (this.visibleCount > 0) {
        this.instancedMesh.instanceMatrix.needsUpdate = true;
      }

      requestAnimationFrame(animate);
    };

    animate();
  }

  public updateInstance(
    entityId: number,
    index: number,
    position: THREE.Vector3,
    scale: number = 1,
    rotation: THREE.Euler = new THREE.Euler(),
    color: THREE.Color = new THREE.Color(0xffcc00),
  ) {
    this.entityToIndex.set(entityId, index);

    this.dummy.position.copy(position);
    this.dummy.position.y += 1; // Float above the ground
    this.dummy.scale.set(scale, scale, scale);
    this.dummy.rotation.copy(rotation);
    this.dummy.updateMatrix();

    this.instancedMesh.setMatrixAt(index, this.dummy.matrix);
    this.instancedMesh.setColorAt(index, color);
  }

  public setVisibleCount(count: number) {
    this.visibleCount = Math.min(count, this.maxInstances);
    this.instancedMesh.count = this.visibleCount;
  }

  public resetInstanceCounts() {
    this.entityToIndex.clear();
    this.visibleCount = 0;
    this.instancedMesh.count = 0;
  }

  public updateAllInstances() {
    if (this.visibleCount > 0) {
      this.instancedMesh.instanceMatrix.needsUpdate = true;
      // this.instancedMesh.instanceColor?.needsUpdate = true;
    }
  }

  public computeBoundingSphere() {
    this.instancedMesh.geometry.computeBoundingSphere();
  }

  // for when model is available
  // private async loadModels(): Promise<void> {
  //   const modelTypes = Object.entries(MODEL_TYPE_TO_FILE);
  //   const loadPromises = modelTypes.map(([type, fileName]) => this.loadSingleModel(type as ModelType, fileName));
  //   await Promise.all(loadPromises);
  // }

  // private async loadSingleModel(modelType: ModelType, fileName: string): Promise<void> {
  //   return new Promise((resolve, reject) => {
  //     gltfLoader.load(
  //       `models/units/${fileName}.glb`,
  //       (gltf) => {
  //         const modelData = this.createModelData(gltf);
  //         this.models.set(modelType, modelData);
  //         resolve();
  //       },
  //       undefined,
  //       reject,
  //     );
  //   });
  // }
}
