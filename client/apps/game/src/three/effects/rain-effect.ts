import * as THREE from "three";

export class RainEffect {
  private scene: THREE.Scene;
  private rainParticles!: THREE.LineSegments;
  private rainGeometry!: THREE.BufferGeometry;
  private rainMaterial!: THREE.LineBasicMaterial;
  private rainPositions!: Float32Array;
  private rainVelocities!: Float32Array;
  private rainCount: number = 800;
  private rainParams = {
    intensity: 0.9,
    speed: 0.15,
    length: 0.3,
    color: 0x4a5568,
    enabled: true,
  };

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.initializeRain();
  }

  private initializeRain() {
    this.rainGeometry = new THREE.BufferGeometry();
    this.rainPositions = new Float32Array(this.rainCount * 6);
    this.rainVelocities = new Float32Array(this.rainCount * 3);

    for (let i = 0; i < this.rainCount; i++) {
      const i6 = i * 6;
      const i3 = i * 3;

      const x = (Math.random() - 0.5) * 20;
      const y = Math.random() * 20;
      const z = (Math.random() - 0.5) * 20;

      this.rainPositions[i6] = x;
      this.rainPositions[i6 + 1] = y;
      this.rainPositions[i6 + 2] = z;
      this.rainPositions[i6 + 3] = x;
      this.rainPositions[i6 + 4] = y - this.rainParams.length;
      this.rainPositions[i6 + 5] = z;

      this.rainVelocities[i3] = (Math.random() - 0.5) * 0.03;
      this.rainVelocities[i3 + 1] = -Math.random() * 0.3 - 0.2;
      this.rainVelocities[i3 + 2] = (Math.random() - 0.5) * 0.03;
    }

    this.rainGeometry.setAttribute("position", new THREE.BufferAttribute(this.rainPositions, 3));

    this.rainMaterial = new THREE.LineBasicMaterial({
      color: this.rainParams.color,
      transparent: true,
      opacity: this.rainParams.intensity,
      linewidth: 1,
    });

    this.rainParticles = new THREE.LineSegments(this.rainGeometry, this.rainMaterial);
    this.scene.add(this.rainParticles);
  }

  update(deltaTime: number) {
    if (!this.rainParams.enabled || !this.rainParticles) return;

    const positions = this.rainGeometry.attributes.position.array as Float32Array;

    for (let i = 0; i < this.rainCount; i++) {
      const i6 = i * 6;
      const i3 = i * 3;

      const deltaX = this.rainVelocities[i3] * this.rainParams.speed * deltaTime * 100;
      const deltaY = this.rainVelocities[i3 + 1] * this.rainParams.speed * deltaTime * 100;
      const deltaZ = this.rainVelocities[i3 + 2] * this.rainParams.speed * deltaTime * 100;

      positions[i6] += deltaX;
      positions[i6 + 1] += deltaY;
      positions[i6 + 2] += deltaZ;
      positions[i6 + 3] += deltaX;
      positions[i6 + 4] += deltaY;
      positions[i6 + 5] += deltaZ;

      if (positions[i6 + 1] < -10) {
        const x = (Math.random() - 0.5) * 20;
        const y = 10;
        const z = (Math.random() - 0.5) * 20;

        positions[i6] = x;
        positions[i6 + 1] = y;
        positions[i6 + 2] = z;
        positions[i6 + 3] = x;
        positions[i6 + 4] = y - this.rainParams.length;
        positions[i6 + 5] = z;
      }
    }

    this.rainGeometry.attributes.position.needsUpdate = true;
  }

  private updateRainLength(length: number) {
    const positions = this.rainGeometry.attributes.position.array as Float32Array;

    for (let i = 0; i < this.rainCount; i++) {
      const i6 = i * 6;
      positions[i6 + 4] = positions[i6 + 1] - length;
    }

    this.rainGeometry.attributes.position.needsUpdate = true;
  }

  addGUIControls(guiFolder: any) {
    const rainFolder = guiFolder.addFolder("Rain");
    rainFolder
      .add(this.rainParams, "enabled")
      .name("Enable Rain")
      .onChange((value: boolean) => {
        this.rainParticles.visible = value;
      });
    rainFolder
      .add(this.rainParams, "intensity", 0, 1)
      .name("Rain Intensity")
      .onChange((value: number) => {
        this.rainMaterial.opacity = value;
      });
    rainFolder.add(this.rainParams, "speed", 0.01, 0.8).name("Rain Speed");
    rainFolder
      .add(this.rainParams, "length", 0.1, 1.0)
      .name("Rain Length")
      .onChange((value: number) => {
        this.updateRainLength(value);
      });
    rainFolder
      .addColor(this.rainParams, "color")
      .name("Rain Color")
      .onChange((value: number) => {
        this.rainMaterial.color.setHex(value);
      });
  }

  setEnabled(enabled: boolean) {
    this.rainParams.enabled = enabled;
    if (this.rainParticles) {
      this.rainParticles.visible = enabled;
    }
  }

  dispose() {
    if (this.rainParticles) {
      this.scene.remove(this.rainParticles);
      this.rainGeometry.dispose();
      this.rainMaterial.dispose();
    }
  }
}
