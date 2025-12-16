import {
  Scene,
  Points,
  BufferGeometry,
  PointsMaterial,
  BufferAttribute,
  Vector3,
  Vector2,
  AdditiveBlending,
  Color,
} from "three";

/**
 * Time of day periods for particle behavior
 */
export enum TimeOfDay {
  DAWN = 0, // 5-7 AM - transitioning
  DAY = 1, // 7 AM - 5 PM - dust motes
  DUSK = 2, // 5-8 PM - fireflies emerge
  NIGHT = 3, // 8 PM - 5 AM - fireflies active
}

interface ParticleState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  phase: number; // For oscillation/pulse
  brightness: number;
  baseY: number; // For vertical drift bounds
}

/**
 * Ambient particle system for atmospheric effects
 * - Dust motes during daytime (slow drifting particles)
 * - Fireflies at dusk/night (glowing, pulsing particles)
 */
export class AmbientParticleSystem {
  private scene: Scene;

  // Dust motes
  private dustGeometry!: BufferGeometry;
  private dustMaterial!: PointsMaterial;
  private dustParticles!: Points;
  private dustPositions!: Float32Array;
  private dustStates: ParticleState[] = [];
  private dustCount = 150;

  // Fireflies
  private fireflyGeometry!: BufferGeometry;
  private fireflyMaterial!: PointsMaterial;
  private fireflyParticles!: Points;
  private fireflyPositions!: Float32Array;
  private fireflyColors!: Float32Array;
  private fireflyStates: ParticleState[] = [];
  private fireflyCount = 60;

  // Shared state
  private spawnCenter: Vector3 = new Vector3(0, 5, 0);
  private spawnRadius = 15;
  private currentTimeOfDay: TimeOfDay = TimeOfDay.DAY;
  private timeBlend = 0; // 0-1 for transitions

  // External wind influence
  private windDirection: Vector2 = new Vector2(1, 0);
  private windSpeed = 0;

  // Visibility
  private dustOpacity = 0;
  private fireflyOpacity = 0;

  // Configuration
  private dustParams = {
    color: 0xfff8e7, // Warm white
    size: 0.08,
    opacity: 0.35,
    driftSpeed: 0.3,
    windInfluence: 0.4,
    verticalDrift: 0.15,
    heightRange: 8, // Vertical spawn range
  };

  private fireflyParams = {
    color: 0xccff66, // Yellow-green glow
    size: 0.12,
    opacity: 0.9,
    pulseSpeed: 2.0,
    pulseMin: 0.2,
    pulseMax: 1.0,
    moveSpeed: 0.5,
    heightRange: 4, // Lower to ground
    heightOffset: 1, // Minimum height above spawn center
  };

  constructor(scene: Scene) {
    this.scene = scene;
    this.initializeDust();
    this.initializeFireflies();
  }

  private initializeDust(): void {
    this.dustGeometry = new BufferGeometry();
    this.dustPositions = new Float32Array(this.dustCount * 3);
    this.dustStates = [];

    for (let i = 0; i < this.dustCount; i++) {
      const state = this.createDustParticle(true);
      this.dustStates.push(state);

      const i3 = i * 3;
      this.dustPositions[i3] = state.x;
      this.dustPositions[i3 + 1] = state.y;
      this.dustPositions[i3 + 2] = state.z;
    }

    this.dustGeometry.setAttribute("position", new BufferAttribute(this.dustPositions, 3));

    this.dustMaterial = new PointsMaterial({
      color: this.dustParams.color,
      size: this.dustParams.size,
      transparent: true,
      opacity: 0, // Start invisible
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.dustParticles = new Points(this.dustGeometry, this.dustMaterial);
    this.dustParticles.frustumCulled = false;
    this.scene.add(this.dustParticles);
  }

  private initializeFireflies(): void {
    this.fireflyGeometry = new BufferGeometry();
    this.fireflyPositions = new Float32Array(this.fireflyCount * 3);
    this.fireflyColors = new Float32Array(this.fireflyCount * 3);
    this.fireflyStates = [];

    const baseColor = new Color(this.fireflyParams.color);

    for (let i = 0; i < this.fireflyCount; i++) {
      const state = this.createFireflyParticle(true);
      this.fireflyStates.push(state);

      const i3 = i * 3;
      this.fireflyPositions[i3] = state.x;
      this.fireflyPositions[i3 + 1] = state.y;
      this.fireflyPositions[i3 + 2] = state.z;

      // Initial colors
      this.fireflyColors[i3] = baseColor.r;
      this.fireflyColors[i3 + 1] = baseColor.g;
      this.fireflyColors[i3 + 2] = baseColor.b;
    }

    this.fireflyGeometry.setAttribute("position", new BufferAttribute(this.fireflyPositions, 3));
    this.fireflyGeometry.setAttribute("color", new BufferAttribute(this.fireflyColors, 3));

    this.fireflyMaterial = new PointsMaterial({
      size: this.fireflyParams.size,
      transparent: true,
      opacity: 0, // Start invisible
      depthWrite: false,
      sizeAttenuation: true,
      vertexColors: true,
      blending: AdditiveBlending, // Glow effect
    });

    this.fireflyParticles = new Points(this.fireflyGeometry, this.fireflyMaterial);
    this.fireflyParticles.frustumCulled = false;
    this.scene.add(this.fireflyParticles);
  }

  private createDustParticle(randomizePosition: boolean): ParticleState {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * this.spawnRadius;
    const x = this.spawnCenter.x + Math.cos(angle) * radius;
    const z = this.spawnCenter.z + Math.sin(angle) * radius;
    const baseY = this.spawnCenter.y + (Math.random() - 0.3) * this.dustParams.heightRange;
    const y = randomizePosition ? baseY : this.spawnCenter.y + this.dustParams.heightRange * 0.5;

    return {
      x,
      y,
      z,
      vx: (Math.random() - 0.5) * 0.01,
      vy: (Math.random() - 0.5) * 0.005,
      vz: (Math.random() - 0.5) * 0.01,
      phase: Math.random() * Math.PI * 2,
      brightness: 0.7 + Math.random() * 0.3,
      baseY,
    };
  }

  private createFireflyParticle(randomizePosition: boolean): ParticleState {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * this.spawnRadius * 0.8;
    const x = this.spawnCenter.x + Math.cos(angle) * radius;
    const z = this.spawnCenter.z + Math.sin(angle) * radius;
    const baseY =
      this.spawnCenter.y + this.fireflyParams.heightOffset + Math.random() * this.fireflyParams.heightRange;
    const y = randomizePosition ? baseY : this.spawnCenter.y + this.fireflyParams.heightOffset;

    return {
      x,
      y,
      z,
      vx: (Math.random() - 0.5) * 0.02,
      vy: (Math.random() - 0.5) * 0.01,
      vz: (Math.random() - 0.5) * 0.02,
      phase: Math.random() * Math.PI * 2,
      brightness: Math.random(),
      baseY,
    };
  }

  update(deltaTime: number, spawnCenter?: Vector3): void {
    if (spawnCenter) {
      this.updateSpawnCenter(spawnCenter);
    }

    this.updateDust(deltaTime);
    this.updateFireflies(deltaTime);
  }

  private updateSpawnCenter(newCenter: Vector3): void {
    const offsetX = newCenter.x - this.spawnCenter.x;
    const offsetY = newCenter.y - this.spawnCenter.y;
    const offsetZ = newCenter.z - this.spawnCenter.z;

    if (offsetX === 0 && offsetY === 0 && offsetZ === 0) return;

    this.spawnCenter.copy(newCenter);

    // Move dust particles with camera
    for (let i = 0; i < this.dustCount; i++) {
      const state = this.dustStates[i];
      state.x += offsetX;
      state.y += offsetY;
      state.z += offsetZ;
      state.baseY += offsetY;
    }

    // Move firefly particles with camera
    for (let i = 0; i < this.fireflyCount; i++) {
      const state = this.fireflyStates[i];
      state.x += offsetX;
      state.y += offsetY;
      state.z += offsetZ;
      state.baseY += offsetY;
    }
  }

  private updateDust(deltaTime: number): void {
    if (this.dustOpacity <= 0) return;

    const windX = this.windDirection.x * this.windSpeed * this.dustParams.windInfluence;
    const windZ = this.windDirection.y * this.windSpeed * this.dustParams.windInfluence;

    for (let i = 0; i < this.dustCount; i++) {
      const state = this.dustStates[i];
      const i3 = i * 3;

      // Update phase for gentle oscillation
      state.phase += deltaTime * 0.5;

      // Drift velocity with wind influence
      state.vx += (windX - state.vx) * deltaTime * 0.5;
      state.vz += (windZ - state.vz) * deltaTime * 0.5;

      // Gentle vertical oscillation
      const verticalDrift = Math.sin(state.phase) * this.dustParams.verticalDrift * deltaTime;
      state.vy += verticalDrift;
      state.vy *= 0.98; // Damping

      // Apply velocities
      state.x += state.vx * this.dustParams.driftSpeed * deltaTime * 60;
      state.y += state.vy * this.dustParams.driftSpeed * deltaTime * 60;
      state.z += state.vz * this.dustParams.driftSpeed * deltaTime * 60;

      // Check bounds and respawn if needed
      const dx = state.x - this.spawnCenter.x;
      const dz = state.z - this.spawnCenter.z;
      const distSq = dx * dx + dz * dz;

      if (distSq > this.spawnRadius * this.spawnRadius * 1.5) {
        // Respawn on opposite side
        const newState = this.createDustParticle(true);
        state.x = newState.x;
        state.y = newState.y;
        state.z = newState.z;
        state.baseY = newState.baseY;
      }

      // Update buffer
      this.dustPositions[i3] = state.x;
      this.dustPositions[i3 + 1] = state.y;
      this.dustPositions[i3 + 2] = state.z;
    }

    this.dustGeometry.attributes.position.needsUpdate = true;
    this.dustMaterial.opacity = this.dustOpacity * this.dustParams.opacity;
  }

  private updateFireflies(deltaTime: number): void {
    if (this.fireflyOpacity <= 0) return;

    const baseColor = new Color(this.fireflyParams.color);

    for (let i = 0; i < this.fireflyCount; i++) {
      const state = this.fireflyStates[i];
      const i3 = i * 3;

      // Update pulse phase
      state.phase += deltaTime * this.fireflyParams.pulseSpeed * (0.8 + Math.random() * 0.4);

      // Calculate pulse brightness (smooth sine wave with occasional "flicker")
      const pulse = Math.sin(state.phase);
      const normalizedPulse = (pulse + 1) * 0.5; // 0-1
      state.brightness =
        this.fireflyParams.pulseMin + normalizedPulse * (this.fireflyParams.pulseMax - this.fireflyParams.pulseMin);

      // Random direction changes (lazy, wandering flight)
      if (Math.random() < deltaTime * 0.5) {
        state.vx += (Math.random() - 0.5) * 0.02;
        state.vy += (Math.random() - 0.5) * 0.01;
        state.vz += (Math.random() - 0.5) * 0.02;
      }

      // Apply velocities with damping
      state.vx *= 0.98;
      state.vy *= 0.98;
      state.vz *= 0.98;

      state.x += state.vx * this.fireflyParams.moveSpeed * deltaTime * 60;
      state.y += state.vy * this.fireflyParams.moveSpeed * deltaTime * 60;
      state.z += state.vz * this.fireflyParams.moveSpeed * deltaTime * 60;

      // Height bounds
      const minY = this.spawnCenter.y + this.fireflyParams.heightOffset;
      const maxY = minY + this.fireflyParams.heightRange;
      if (state.y < minY) {
        state.y = minY;
        state.vy = Math.abs(state.vy);
      } else if (state.y > maxY) {
        state.y = maxY;
        state.vy = -Math.abs(state.vy);
      }

      // Horizontal bounds
      const dx = state.x - this.spawnCenter.x;
      const dz = state.z - this.spawnCenter.z;
      const distSq = dx * dx + dz * dz;
      const maxDistSq = this.spawnRadius * this.spawnRadius;

      if (distSq > maxDistSq) {
        // Gently push back toward center
        const dist = Math.sqrt(distSq);
        state.vx -= (dx / dist) * 0.01;
        state.vz -= (dz / dist) * 0.01;
      }

      // Update position buffer
      this.fireflyPositions[i3] = state.x;
      this.fireflyPositions[i3 + 1] = state.y;
      this.fireflyPositions[i3 + 2] = state.z;

      // Update color buffer with brightness
      const brightness = state.brightness * this.fireflyOpacity;
      this.fireflyColors[i3] = baseColor.r * brightness;
      this.fireflyColors[i3 + 1] = baseColor.g * brightness;
      this.fireflyColors[i3 + 2] = baseColor.b * brightness;
    }

    this.fireflyGeometry.attributes.position.needsUpdate = true;
    this.fireflyGeometry.attributes.color.needsUpdate = true;
    this.fireflyMaterial.opacity = this.fireflyOpacity * this.fireflyParams.opacity;
  }

  /**
   * Set time of day to control which particles are visible
   * @param progress - Day progress 0-100 where 0/100 = midnight, 50 = noon
   */
  setTimeProgress(progress: number): void {
    // Determine time of day from progress
    // 0-100 scale: 0 = midnight, 25 = 6AM, 50 = noon, 75 = 6PM, 100 = midnight
    let timeOfDay: TimeOfDay;
    let blend = 0;

    if (progress >= 20 && progress < 30) {
      // Dawn: 5-7 AM
      timeOfDay = TimeOfDay.DAWN;
      blend = (progress - 20) / 10; // 0-1 through dawn
    } else if (progress >= 30 && progress < 70) {
      // Day: 7 AM - 5 PM
      timeOfDay = TimeOfDay.DAY;
      blend = 1;
    } else if (progress >= 70 && progress < 85) {
      // Dusk: 5-8 PM
      timeOfDay = TimeOfDay.DUSK;
      blend = (progress - 70) / 15;
    } else {
      // Night: 8 PM - 5 AM
      timeOfDay = TimeOfDay.NIGHT;
      blend = 1;
    }

    this.currentTimeOfDay = timeOfDay;
    this.timeBlend = blend;

    // Update opacities based on time
    this.updateParticleVisibility();
  }

  private updateParticleVisibility(): void {
    switch (this.currentTimeOfDay) {
      case TimeOfDay.DAWN:
        // Fireflies fading out, dust fading in
        this.fireflyOpacity = 1 - this.timeBlend;
        this.dustOpacity = this.timeBlend;
        break;

      case TimeOfDay.DAY:
        // Full dust, no fireflies
        this.dustOpacity = 1;
        this.fireflyOpacity = 0;
        break;

      case TimeOfDay.DUSK:
        // Dust fading out, fireflies fading in
        this.dustOpacity = 1 - this.timeBlend;
        this.fireflyOpacity = this.timeBlend;
        break;

      case TimeOfDay.NIGHT:
        // Full fireflies, no dust
        this.dustOpacity = 0;
        this.fireflyOpacity = 1;
        break;
    }
  }

  /**
   * Set wind from external system
   */
  setWind(direction: Vector2, speed: number): void {
    this.windDirection.copy(direction);
    this.windSpeed = speed;
  }

  /**
   * Set spawn radius for particles
   */
  setSpawnRadius(radius: number): void {
    this.spawnRadius = radius;
  }

  /**
   * Enable or disable the entire system
   */
  setEnabled(enabled: boolean): void {
    this.dustParticles.visible = enabled;
    this.fireflyParticles.visible = enabled;
  }

  /**
   * Hide particles during rain/storm
   */
  setWeatherIntensity(intensity: number): void {
    // Fade out particles as weather intensity increases
    const weatherFade = 1 - intensity;
    this.dustMaterial.opacity = this.dustOpacity * this.dustParams.opacity * weatherFade;
    this.fireflyMaterial.opacity = this.fireflyOpacity * this.fireflyParams.opacity * weatherFade;
  }

  dispose(): void {
    this.scene.remove(this.dustParticles);
    this.scene.remove(this.fireflyParticles);

    this.dustGeometry.dispose();
    this.dustMaterial.dispose();
    this.fireflyGeometry.dispose();
    this.fireflyMaterial.dispose();
  }
}
