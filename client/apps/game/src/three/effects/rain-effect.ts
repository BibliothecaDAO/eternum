import { Scene, LineSegments, BufferGeometry, LineBasicMaterial, BufferAttribute, Vector3 } from "three";

interface RainSpawnVolume {
  width: number;
  depth: number;
  minHeightOffset: number;
  maxHeightOffset: number;
  resetHeightOffset: number;
  floorOffset: number;
}

export class RainEffect {
  private scene: Scene;
  private rainParticles!: LineSegments;
  private rainGeometry!: BufferGeometry;
  private rainMaterial!: LineBasicMaterial;
  private rainPositions!: Float32Array;
  private rainVelocities!: Float32Array;
  private rainCount: number = 800;
  private spawnCenter: Vector3 = new Vector3(0, 10, 0);
  private spawnVolume: RainSpawnVolume = {
    width: 20,
    depth: 20,
    minHeightOffset: -10,
    maxHeightOffset: 10,
    resetHeightOffset: 0,
    floorOffset: 20,
  };
  private wind: Vector3 = new Vector3();
  private windTarget: Vector3 = new Vector3();
  private windTimer = 0;
  private gravityStrength = -0.25;
  private terminalFallSpeed = -0.9;
  private windParams = {
    maxStrength: 0.06,
    minChangeInterval: 2,
    maxChangeInterval: 5,
    lerpSpeed: 0.5,
    maxHorizontalVelocity: 0.12,
    horizontalDamping: 0.98,
  };
  private rainParams = {
    intensity: 0.9,
    speed: 0.15,
    length: 0.3,
    color: 0x4a5568,
    enabled: true,
  };

  constructor(scene: Scene) {
    this.scene = scene;
    this.initializeRain();
  }

  private initializeRain() {
    this.rainGeometry = new BufferGeometry();
    this.rainPositions = new Float32Array(this.rainCount * 6);
    this.rainVelocities = new Float32Array(this.rainCount * 3);

    for (let i = 0; i < this.rainCount; i++) {
      this.resetDrop(i, this.rainPositions, true);
    }

    this.rainGeometry.setAttribute("position", new BufferAttribute(this.rainPositions, 3));

    this.rainMaterial = new LineBasicMaterial({
      color: this.rainParams.color,
      transparent: true,
      opacity: this.rainParams.intensity,
      linewidth: 1,
    });

    this.rainParticles = new LineSegments(this.rainGeometry, this.rainMaterial);
    this.scene.add(this.rainParticles);
  }

  update(deltaTime: number, spawnCenter?: Vector3) {
    if (!this.rainParams.enabled || !this.rainParticles) return;

    if (spawnCenter) {
      this.setSpawnCenter(spawnCenter);
    }

    this.updateWind(deltaTime);

    const positions = this.rainGeometry.attributes.position.array as Float32Array;
    const minY = this.spawnCenter.y - this.spawnVolume.floorOffset;
    const maxY = this.spawnCenter.y + this.spawnVolume.maxHeightOffset;

    for (let i = 0; i < this.rainCount; i++) {
      const i6 = i * 6;
      const i3 = i * 3;

      this.rainVelocities[i3] = this.applyHorizontalVelocity(this.rainVelocities[i3], this.wind.x, deltaTime);
      this.rainVelocities[i3 + 2] = this.applyHorizontalVelocity(this.rainVelocities[i3 + 2], this.wind.z, deltaTime);

      this.rainVelocities[i3 + 1] += this.gravityStrength * deltaTime;
      if (this.rainVelocities[i3 + 1] < this.terminalFallSpeed) {
        this.rainVelocities[i3 + 1] = this.terminalFallSpeed;
      }

      const deltaX = this.rainVelocities[i3] * this.rainParams.speed * deltaTime * 100;
      const deltaY = this.rainVelocities[i3 + 1] * this.rainParams.speed * deltaTime * 100;
      const deltaZ = this.rainVelocities[i3 + 2] * this.rainParams.speed * deltaTime * 100;

      positions[i6] += deltaX;
      positions[i6 + 1] += deltaY;
      positions[i6 + 2] += deltaZ;
      positions[i6 + 3] += deltaX;
      positions[i6 + 4] += deltaY;
      positions[i6 + 5] += deltaZ;

      if (positions[i6 + 1] < minY) {
        this.resetDrop(i, positions, false);
      } else if (positions[i6 + 1] > maxY) {
        const clampedTop = maxY;
        positions[i6 + 1] = clampedTop;
        positions[i6 + 4] = clampedTop - this.rainParams.length;
        this.rainVelocities[i3 + 1] = Math.min(this.rainVelocities[i3 + 1], -0.1);
      }
    }

    this.rainGeometry.attributes.position.needsUpdate = true;
  }

  private applyHorizontalVelocity(current: number, windComponent: number, deltaTime: number) {
    const nextVelocity = (current + windComponent * deltaTime) * this.windParams.horizontalDamping;
    const limit = this.windParams.maxHorizontalVelocity;
    if (nextVelocity > limit) return limit;
    if (nextVelocity < -limit) return -limit;
    return nextVelocity;
  }

  private updateWind(deltaTime: number) {
    this.windTimer -= deltaTime;
    if (this.windTimer <= 0) {
      this.windTarget.set(
        (Math.random() - 0.5) * this.windParams.maxStrength,
        0,
        (Math.random() - 0.5) * this.windParams.maxStrength,
      );

      const intervalRange = this.windParams.maxChangeInterval - this.windParams.minChangeInterval;
      this.windTimer = this.windParams.minChangeInterval + Math.random() * intervalRange;
    }

    const lerpFactor = Math.min(1, deltaTime * this.windParams.lerpSpeed);
    this.wind.lerp(this.windTarget, lerpFactor);
  }

  private resetDrop(index: number, positions: Float32Array, randomizeHeight: boolean) {
    const i6 = index * 6;
    const i3 = index * 3;
    const x = this.spawnCenter.x + (Math.random() - 0.5) * this.spawnVolume.width;
    const z = this.spawnCenter.z + (Math.random() - 0.5) * this.spawnVolume.depth;
    const heightRange = this.spawnVolume.maxHeightOffset - this.spawnVolume.minHeightOffset;
    const topY = randomizeHeight
      ? this.spawnCenter.y + this.spawnVolume.minHeightOffset + Math.random() * heightRange
      : this.spawnCenter.y + this.spawnVolume.resetHeightOffset;

    positions[i6] = x;
    positions[i6 + 1] = topY;
    positions[i6 + 2] = z;
    positions[i6 + 3] = x;
    positions[i6 + 4] = topY - this.rainParams.length;
    positions[i6 + 5] = z;

    this.rainVelocities[i3] = (Math.random() - 0.5) * 0.03;
    this.rainVelocities[i3 + 1] = -Math.random() * 0.3 - 0.2;
    this.rainVelocities[i3 + 2] = (Math.random() - 0.5) * 0.03;
  }

  setSpawnCenter(center: Vector3) {
    const offsetX = center.x - this.spawnCenter.x;
    const offsetY = center.y - this.spawnCenter.y;
    const offsetZ = center.z - this.spawnCenter.z;

    if (offsetX === 0 && offsetY === 0 && offsetZ === 0) {
      return;
    }

    this.spawnCenter.copy(center);

    if (!this.rainGeometry) return;

    const positions = this.rainGeometry.attributes.position.array as Float32Array;
    for (let i = 0; i < this.rainCount; i++) {
      const i6 = i * 6;
      positions[i6] += offsetX;
      positions[i6 + 1] += offsetY;
      positions[i6 + 2] += offsetZ;
      positions[i6 + 3] += offsetX;
      positions[i6 + 4] += offsetY;
      positions[i6 + 5] += offsetZ;
    }

    this.rainGeometry.attributes.position.needsUpdate = true;
  }

  setSpawnVolume(volume: Partial<RainSpawnVolume>) {
    this.spawnVolume = { ...this.spawnVolume, ...volume };

    if (!this.rainGeometry) return;

    const positions = this.rainGeometry.attributes.position.array as Float32Array;
    for (let i = 0; i < this.rainCount; i++) {
      this.resetDrop(i, positions, true);
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
