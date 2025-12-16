import { Scene, LineSegments, BufferGeometry, LineBasicMaterial, BufferAttribute, Vector3, Vector2, Color } from "three";

interface RainSpawnVolume {
  width: number;
  depth: number;
  minHeightOffset: number;
  maxHeightOffset: number;
  resetHeightOffset: number;
  floorOffset: number;
}

/**
 * Drop size category for visual variety
 */
enum DropSize {
  SMALL = 0,  // Fine mist, distant drops
  MEDIUM = 1, // Standard rain
  LARGE = 2,  // Heavy drops, close to camera
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

  // External wind control (from WindSystem)
  private useExternalWind: boolean = false;
  private externalWindDirection: Vector2 = new Vector2(1, 0);
  private externalWindSpeed: number = 0;

  // Weather-driven intensity
  private weatherIntensity: number = 1.0;

  // Per-drop properties for size/speed variance
  private dropLengths!: Float32Array;      // Individual drop lengths
  private dropSpeedMultipliers!: Float32Array; // Individual fall speed multipliers
  private dropSizes!: Uint8Array;          // Size category (0=small, 1=medium, 2=large)
  private rainColors!: Float32Array;       // Per-vertex colors (RGB per vertex, 2 vertices per drop)

  private windParams = {
    maxStrength: 0.06,
    minChangeInterval: 2,
    maxChangeInterval: 5,
    lerpSpeed: 0.5,
    maxHorizontalVelocity: 0.12,
    horizontalDamping: 0.98,
    // Wind strength multiplier when using external wind
    externalWindMultiplier: 0.15,
  };

  private rainParams = {
    intensity: 0.9,
    speed: 0.15,
    length: 0.3,
    color: 0x4a5568,
    enabled: true,
  };

  // Size variance settings
  private sizeParams = {
    // Distribution: what percentage of drops are each size
    smallPercent: 0.4,   // 40% small (distant, fine)
    mediumPercent: 0.4,  // 40% medium (standard)
    largePercent: 0.2,   // 20% large (heavy, close)

    // Length multipliers for each size
    smallLengthMin: 0.15,
    smallLengthMax: 0.25,
    mediumLengthMin: 0.25,
    mediumLengthMax: 0.4,
    largeLengthMin: 0.4,
    largeLengthMax: 0.6,

    // Speed multipliers for each size (larger drops fall faster)
    smallSpeedMult: 0.7,
    mediumSpeedMult: 1.0,
    largeSpeedMult: 1.3,

    // Spawn depth preference (larger drops spawn closer to camera center)
    largeDropCenterBias: 0.6, // 0-1, how much large drops prefer center

    // Brightness multipliers (simulates distance/opacity via color)
    smallBrightness: 0.4,   // Faint, distant drops
    mediumBrightness: 0.7,  // Standard visibility
    largeBrightness: 1.0,   // Bright, close drops
  };

  constructor(scene: Scene) {
    this.scene = scene;
    this.initializeRain();
  }

  private initializeRain() {
    this.rainGeometry = new BufferGeometry();
    this.rainPositions = new Float32Array(this.rainCount * 6);
    this.rainVelocities = new Float32Array(this.rainCount * 3);
    this.rainColors = new Float32Array(this.rainCount * 6); // RGB for 2 vertices per drop

    // Initialize per-drop variance arrays
    this.dropLengths = new Float32Array(this.rainCount);
    this.dropSpeedMultipliers = new Float32Array(this.rainCount);
    this.dropSizes = new Uint8Array(this.rainCount);

    // Parse base color for vertex color modulation
    const baseColor = new Color(this.rainParams.color);

    for (let i = 0; i < this.rainCount; i++) {
      this.assignDropSize(i);
      this.resetDrop(i, this.rainPositions, true);

      // Set vertex colors based on drop size (brightness variation)
      this.updateDropColor(i, baseColor);
    }

    this.rainGeometry.setAttribute("position", new BufferAttribute(this.rainPositions, 3));
    this.rainGeometry.setAttribute("color", new BufferAttribute(this.rainColors, 3));

    this.rainMaterial = new LineBasicMaterial({
      vertexColors: true, // Enable per-vertex colors
      transparent: true,
      opacity: this.rainParams.intensity,
      linewidth: 1,
      fog: true, // Enable fog for distance fade
    });

    this.rainParticles = new LineSegments(this.rainGeometry, this.rainMaterial);
    this.scene.add(this.rainParticles);
  }

  /**
   * Update vertex colors for a drop based on its size category
   */
  private updateDropColor(index: number, baseColor: Color): void {
    const i6 = index * 6;
    const dropSize = this.dropSizes[index];

    // Get brightness multiplier based on size
    let brightness: number;
    switch (dropSize) {
      case DropSize.SMALL:
        brightness = this.sizeParams.smallBrightness;
        break;
      case DropSize.MEDIUM:
        brightness = this.sizeParams.mediumBrightness;
        break;
      case DropSize.LARGE:
        brightness = this.sizeParams.largeBrightness;
        break;
      default:
        brightness = 1.0;
    }

    // Add slight random variation for natural look
    brightness *= 0.9 + Math.random() * 0.2;

    // Apply brightness to base color
    const r = baseColor.r * brightness;
    const g = baseColor.g * brightness;
    const b = baseColor.b * brightness;

    // Top vertex
    this.rainColors[i6] = r;
    this.rainColors[i6 + 1] = g;
    this.rainColors[i6 + 2] = b;

    // Bottom vertex (slightly darker for depth)
    this.rainColors[i6 + 3] = r * 0.8;
    this.rainColors[i6 + 4] = g * 0.8;
    this.rainColors[i6 + 5] = b * 0.8;
  }

  /**
   * Assign a size category to a drop based on distribution settings
   */
  private assignDropSize(index: number): void {
    const rand = Math.random();
    const { smallPercent, mediumPercent } = this.sizeParams;

    let size: DropSize;
    let length: number;
    let speedMult: number;

    if (rand < smallPercent) {
      // Small drops - fine mist
      size = DropSize.SMALL;
      length = this.sizeParams.smallLengthMin +
        Math.random() * (this.sizeParams.smallLengthMax - this.sizeParams.smallLengthMin);
      speedMult = this.sizeParams.smallSpeedMult * (0.9 + Math.random() * 0.2);
    } else if (rand < smallPercent + mediumPercent) {
      // Medium drops - standard rain
      size = DropSize.MEDIUM;
      length = this.sizeParams.mediumLengthMin +
        Math.random() * (this.sizeParams.mediumLengthMax - this.sizeParams.mediumLengthMin);
      speedMult = this.sizeParams.mediumSpeedMult * (0.9 + Math.random() * 0.2);
    } else {
      // Large drops - heavy rain
      size = DropSize.LARGE;
      length = this.sizeParams.largeLengthMin +
        Math.random() * (this.sizeParams.largeLengthMax - this.sizeParams.largeLengthMin);
      speedMult = this.sizeParams.largeSpeedMult * (0.9 + Math.random() * 0.2);
    }

    this.dropSizes[index] = size;
    this.dropLengths[index] = length;
    this.dropSpeedMultipliers[index] = speedMult;
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

      // Get per-drop properties
      const speedMult = this.dropSpeedMultipliers[i];
      const dropLength = this.dropLengths[i];

      this.rainVelocities[i3] = this.applyHorizontalVelocity(this.rainVelocities[i3], this.wind.x, deltaTime);
      this.rainVelocities[i3 + 2] = this.applyHorizontalVelocity(this.rainVelocities[i3 + 2], this.wind.z, deltaTime);

      // Apply gravity with per-drop speed multiplier
      this.rainVelocities[i3 + 1] += this.gravityStrength * deltaTime * speedMult;
      const terminalSpeed = this.terminalFallSpeed * speedMult;
      if (this.rainVelocities[i3 + 1] < terminalSpeed) {
        this.rainVelocities[i3 + 1] = terminalSpeed;
      }

      const deltaX = this.rainVelocities[i3] * this.rainParams.speed * deltaTime * 100;
      const deltaY = this.rainVelocities[i3 + 1] * this.rainParams.speed * deltaTime * 100;
      const deltaZ = this.rainVelocities[i3 + 2] * this.rainParams.speed * deltaTime * 100;

      // Update top vertex
      positions[i6] += deltaX;
      positions[i6 + 1] += deltaY;
      positions[i6 + 2] += deltaZ;

      // Update bottom vertex (maintain per-drop length)
      positions[i6 + 3] += deltaX;
      positions[i6 + 4] = positions[i6 + 1] - dropLength; // Use per-drop length
      positions[i6 + 5] += deltaZ;

      if (positions[i6 + 1] < minY) {
        this.resetDrop(i, positions, false);
      } else if (positions[i6 + 1] > maxY) {
        const clampedTop = maxY;
        positions[i6 + 1] = clampedTop;
        positions[i6 + 4] = clampedTop - dropLength;
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
    if (this.useExternalWind) {
      // Use wind from WindSystem - direction * speed * multiplier
      const strength = this.externalWindSpeed * this.windParams.externalWindMultiplier;
      this.windTarget.set(
        this.externalWindDirection.x * strength,
        0,
        this.externalWindDirection.y * strength,
      );
    } else {
      // Internal wind simulation (fallback)
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
    }

    const lerpFactor = Math.min(1, deltaTime * this.windParams.lerpSpeed);
    this.wind.lerp(this.windTarget, lerpFactor);
  }

  private resetDrop(index: number, positions: Float32Array, randomizeHeight: boolean) {
    const i6 = index * 6;
    const i3 = index * 3;

    // Get drop size for spawn position bias
    const dropSize = this.dropSizes[index];
    const dropLength = this.dropLengths[index];

    // Large drops spawn closer to center for depth perception
    let x: number;
    let z: number;
    if (dropSize === DropSize.LARGE && Math.random() < this.sizeParams.largeDropCenterBias) {
      // Spawn closer to center
      const centerBias = 0.5;
      x = this.spawnCenter.x + (Math.random() - 0.5) * this.spawnVolume.width * centerBias;
      z = this.spawnCenter.z + (Math.random() - 0.5) * this.spawnVolume.depth * centerBias;
    } else {
      x = this.spawnCenter.x + (Math.random() - 0.5) * this.spawnVolume.width;
      z = this.spawnCenter.z + (Math.random() - 0.5) * this.spawnVolume.depth;
    }

    const heightRange = this.spawnVolume.maxHeightOffset - this.spawnVolume.minHeightOffset;
    const topY = randomizeHeight
      ? this.spawnCenter.y + this.spawnVolume.minHeightOffset + Math.random() * heightRange
      : this.spawnCenter.y + this.spawnVolume.resetHeightOffset;

    positions[i6] = x;
    positions[i6 + 1] = topY;
    positions[i6 + 2] = z;
    positions[i6 + 3] = x;
    positions[i6 + 4] = topY - dropLength; // Use per-drop length
    positions[i6 + 5] = z;

    // Initial velocity varies by size
    const speedMult = this.dropSpeedMultipliers[index];
    this.rainVelocities[i3] = (Math.random() - 0.5) * 0.03;
    this.rainVelocities[i3 + 1] = (-Math.random() * 0.3 - 0.2) * speedMult;
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

  /**
   * Set wind from the unified WindSystem
   * @param direction - Normalized wind direction (x, z)
   * @param speed - Wind speed 0-1 (effective speed including gusts)
   */
  setWindFromSystem(direction: Vector2, speed: number): void {
    this.useExternalWind = true;
    this.externalWindDirection.copy(direction);
    this.externalWindSpeed = speed;
  }

  /**
   * Disable external wind and use internal simulation
   */
  useInternalWind(): void {
    this.useExternalWind = false;
  }

  /**
   * Set rain intensity from weather system (0-1)
   * Affects opacity and can be used to scale particle behavior
   */
  setIntensity(intensity: number): void {
    this.weatherIntensity = Math.max(0, Math.min(1, intensity));

    // Update visual intensity
    if (this.rainMaterial) {
      // Combine base intensity with weather intensity
      this.rainMaterial.opacity = this.rainParams.intensity * this.weatherIntensity;
    }
  }

  /**
   * Get current weather intensity
   */
  getIntensity(): number {
    return this.weatherIntensity;
  }

  dispose() {
    if (this.rainParticles) {
      this.scene.remove(this.rainParticles);
      this.rainGeometry.dispose();
      this.rainMaterial.dispose();
    }
  }
}
