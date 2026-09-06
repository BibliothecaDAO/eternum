import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  RGBAFormat,
  Scene,
  SphereGeometry,
  UnsignedByteType,
  Vector2,
  Vector3,
} from "three";

interface FogParticleState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  phase: number;
  baseY: number;
}

interface MistParticleState {
  angle: number;
  radius: number;
  y: number;
  angularSpeed: number;
  phase: number;
  brightness: number;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Seeded pseudo-random number generator (mulberry32) for deterministic starfield */
function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * HexceptionAmbienceSystem — atmospheric ambience for the hexception (settlement) view.
 *
 * Features:
 *  1. CentralSettlementLight — warm PointLight at grid center
 *  2. RadialColorTemperature — ground-plane radial gradient DataTexture
 *  3. GroundFogLayer — low-altitude particle mist drifting across hex surfaces
 *  4. EdgeBoundaryMist — ring of particles at hex grid perimeter
 *  6. SubtleBackground — inverted sphere starfield
 */
export class HexceptionAmbienceSystem {
  private scene: Scene;

  // Master state
  private enabled = true;
  private reducedMotion = false;
  private timeProgress = 50; // 0-100
  private weatherIntensity = 0; // 0-1

  // Feature 1: Central Settlement Light
  private settlementLight: PointLight | null = null;
  private settlementLightEnabled = true;
  private settlementLightBaseIntensity = 0.3;

  // Feature 2: Radial Color Temperature
  private radialMesh: Mesh | null = null;
  private radialTexture: DataTexture | null = null;
  private radialMaterial: MeshBasicMaterial | null = null;
  private radialGeometry: PlaneGeometry | null = null;
  private radialEnabled = true;

  // Feature 3: Ground Fog Layer
  private fogPoints: Points | null = null;
  private fogGeometry: BufferGeometry | null = null;
  private fogMaterial: PointsMaterial | null = null;
  private fogPositions: Float32Array | null = null;
  private fogStates: FogParticleState[] = [];
  private fogEnabled = true;
  private fogBaseOpacity = 0.15;
  private fogSpawnRadius = 8;
  private fogCenter = new Vector3(0, 0, 0);

  // Feature 4: Edge Boundary Mist
  private mistPoints: Points | null = null;
  private mistGeometry: BufferGeometry | null = null;
  private mistMaterial: PointsMaterial | null = null;
  private mistPositions: Float32Array | null = null;
  private mistColors: Float32Array | null = null;
  private mistStates: MistParticleState[] = [];
  private mistEnabled = true;
  private mistGridCenter = new Vector3(0, 0, 0);
  private mistGridRadius = 10;

  // Feature 6: Subtle Background
  private backgroundMesh: Mesh | null = null;
  private backgroundTexture: DataTexture | null = null;
  private backgroundMaterial: MeshBasicMaterial | null = null;
  private backgroundGeometry: SphereGeometry | null = null;
  private backgroundEnabled = true;

  // Wind
  private windDirection = new Vector2(1, 0);
  private windSpeed = 0;

  constructor(scene: Scene) {
    this.scene = scene;

    this.initSettlementLight();
    this.initRadialGradient();
    this.initGroundFog();
    this.initBackground();
  }

  // ───────── Feature 1: Central Settlement Light ─────────

  private initSettlementLight(): void {
    this.settlementLight = new PointLight(0xffaa66, 0.3, 12, 2);
    this.settlementLight.position.set(0, 3, 0);
    this.settlementLight.castShadow = false;
    this.scene.add(this.settlementLight);
  }

  // ───────── Feature 2: Radial Color Temperature ─────────

  private initRadialGradient(): void {
    const size = 128;
    const data = new Uint8Array(size * size * 4);
    const half = size / 2;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x - half) / half;
        const dy = (y - half) / half;
        const dist = clamp01(Math.sqrt(dx * dx + dy * dy));

        const idx = (y * size + x) * 4;
        // warm center -> cool edge
        data[idx] = Math.round(lerp(255, 68, dist)); // R
        data[idx + 1] = Math.round(lerp(136, 34, dist)); // G
        data[idx + 2] = Math.round(lerp(68, 170, dist)); // B
        data[idx + 3] = Math.round(lerp(20, 0, dist)); // A
      }
    }

    this.radialTexture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
    this.radialTexture.needsUpdate = true;

    this.radialMaterial = new MeshBasicMaterial({
      map: this.radialTexture,
      transparent: true,
      depthWrite: false,
      opacity: 1,
    });

    this.radialGeometry = new PlaneGeometry(20, 20);
    this.radialMesh = new Mesh(this.radialGeometry, this.radialMaterial);
    this.radialMesh.rotation.x = -Math.PI / 2;
    this.radialMesh.position.y = -0.03;
    this.scene.add(this.radialMesh);
  }

  // ───────── Feature 3: Ground Fog Layer ─────────

  private getFogParticleCount(): number {
    return 80;
  }

  private initGroundFog(): void {
    const count = this.getFogParticleCount();
    if (count === 0) return;

    this.fogGeometry = new BufferGeometry();
    this.fogPositions = new Float32Array(count * 3);
    this.fogStates = [];

    const rng = seededRandom(123);

    for (let i = 0; i < count; i++) {
      const angle = rng() * Math.PI * 2;
      const radius = rng() * this.fogSpawnRadius;
      const x = this.fogCenter.x + Math.cos(angle) * radius;
      const z = this.fogCenter.z + Math.sin(angle) * radius;
      const y = 0.05 + rng() * 0.35; // 0.05 to 0.4

      const state: FogParticleState = {
        x,
        y,
        z,
        vx: (rng() - 0.5) * 0.01,
        vz: (rng() - 0.5) * 0.01,
        phase: rng() * Math.PI * 2,
        baseY: y,
      };
      this.fogStates.push(state);

      const i3 = i * 3;
      this.fogPositions[i3] = state.x;
      this.fogPositions[i3 + 1] = state.y;
      this.fogPositions[i3 + 2] = state.z;
    }

    this.fogGeometry.setAttribute("position", new BufferAttribute(this.fogPositions, 3));

    this.fogMaterial = new PointsMaterial({
      color: 0xeeddcc,
      size: 0.06,
      transparent: true,
      opacity: this.fogBaseOpacity,
      depthWrite: false,
      sizeAttenuation: true,
      blending: AdditiveBlending,
    });

    this.fogPoints = new Points(this.fogGeometry, this.fogMaterial);
    this.fogPoints.frustumCulled = false;
    this.scene.add(this.fogPoints);
  }

  private updateGroundFog(deltaTime: number): void {
    if (!this.fogPoints || !this.fogPositions || !this.fogGeometry || !this.fogMaterial) return;

    const windX = this.windDirection.x * this.windSpeed * 0.3;
    const windZ = this.windDirection.y * this.windSpeed * 0.3;

    for (let i = 0; i < this.fogStates.length; i++) {
      const state = this.fogStates[i];
      const i3 = i * 3;

      // Update phase for vertical oscillation
      state.phase += deltaTime * 0.5;

      // Horizontal drift with wind influence
      state.vx += (windX - state.vx) * deltaTime * 0.3;
      state.vz += (windZ - state.vz) * deltaTime * 0.3;

      // Apply velocities
      state.x += state.vx * 0.15 * deltaTime * 60;
      state.z += state.vz * 0.15 * deltaTime * 60;

      // Vertical sine oscillation
      state.y = state.baseY + Math.sin(state.phase) * 0.05;
      // Clamp to valid range
      state.y = Math.max(0.05, Math.min(0.4, state.y));

      // Respawn if out of radius
      const dx = state.x - this.fogCenter.x;
      const dz = state.z - this.fogCenter.z;
      const distSq = dx * dx + dz * dz;
      if (distSq > this.fogSpawnRadius * this.fogSpawnRadius) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * this.fogSpawnRadius * 0.5;
        state.x = this.fogCenter.x + Math.cos(angle) * r;
        state.z = this.fogCenter.z + Math.sin(angle) * r;
      }

      this.fogPositions[i3] = state.x;
      this.fogPositions[i3 + 1] = state.y;
      this.fogPositions[i3 + 2] = state.z;
    }

    this.fogGeometry.attributes.position.needsUpdate = true;

    // Compute fog opacity based on time-of-day and weather
    const weatherFade = 1.0 - this.weatherIntensity;
    this.fogMaterial.opacity = this.fogBaseOpacity * weatherFade;
  }

  // ───────── Feature 4: Edge Boundary Mist ─────────

  private getMistParticleCount(): number {
    return 100;
  }

  private initEdgeMist(gridCenter: Vector3, gridRadius: number): void {
    // Clean up any previous mist
    this.disposeEdgeMist();

    const count = this.getMistParticleCount();
    if (count === 0) return;

    this.mistGridCenter.copy(gridCenter);
    this.mistGridRadius = gridRadius;

    this.mistGeometry = new BufferGeometry();
    this.mistPositions = new Float32Array(count * 3);
    this.mistColors = new Float32Array(count * 3);
    this.mistStates = [];

    const rng = seededRandom(456);
    const innerRadius = gridRadius * 0.6;
    const outerRadius = gridRadius * 1.2;

    for (let i = 0; i < count; i++) {
      const angle = rng() * Math.PI * 2;
      const radius = innerRadius + rng() * (outerRadius - innerRadius);
      const y = gridCenter.y + rng() * 0.5;

      // Brightness fades from inner (brighter) to outer (dimmer)
      const radiusFraction = (radius - innerRadius) / (outerRadius - innerRadius);
      const brightness = lerp(0.12, 0.02, radiusFraction);

      const state: MistParticleState = {
        angle,
        radius,
        y,
        angularSpeed: 0.05 * (0.8 + rng() * 0.4) * (rng() > 0.5 ? 1 : -1),
        phase: rng() * Math.PI * 2,
        brightness,
      };
      this.mistStates.push(state);

      const i3 = i * 3;
      this.mistPositions[i3] = gridCenter.x + Math.cos(angle) * radius;
      this.mistPositions[i3 + 1] = y;
      this.mistPositions[i3 + 2] = gridCenter.z + Math.sin(angle) * radius;

      // Per-vertex colors (purple with brightness)
      this.mistColors[i3] = (0x88 / 255) * brightness * 10;
      this.mistColors[i3 + 1] = (0x66 / 255) * brightness * 10;
      this.mistColors[i3 + 2] = (0xaa / 255) * brightness * 10;
    }

    this.mistGeometry.setAttribute("position", new BufferAttribute(this.mistPositions, 3));
    this.mistGeometry.setAttribute("color", new BufferAttribute(this.mistColors, 3));

    this.mistMaterial = new PointsMaterial({
      color: 0x8866aa,
      size: 0.2,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      sizeAttenuation: true,
      blending: AdditiveBlending,
      vertexColors: true,
    });

    this.mistPoints = new Points(this.mistGeometry, this.mistMaterial);
    this.mistPoints.frustumCulled = false;

    this.scene.add(this.mistPoints);
    this.applyMistState();
  }

  private updateEdgeMist(deltaTime: number): void {
    if (!this.mistPoints || !this.mistPositions || !this.mistGeometry) return;

    for (let i = 0; i < this.mistStates.length; i++) {
      const state = this.mistStates[i];
      const i3 = i * 3;

      // Circular drift
      state.angle += state.angularSpeed * deltaTime;
      // Vertical bob
      state.phase += deltaTime * 0.8;
      const yBob = Math.sin(state.phase) * 0.05;

      this.mistPositions[i3] = this.mistGridCenter.x + Math.cos(state.angle) * state.radius;
      this.mistPositions[i3 + 1] = state.y + yBob;
      this.mistPositions[i3 + 2] = this.mistGridCenter.z + Math.sin(state.angle) * state.radius;
    }

    this.mistGeometry.attributes.position.needsUpdate = true;
  }

  private disposeEdgeMist(): void {
    if (this.mistPoints) {
      this.scene.remove(this.mistPoints);
      this.mistGeometry?.dispose();
      this.mistMaterial?.dispose();
      this.mistPoints = null;
      this.mistGeometry = null;
      this.mistMaterial = null;
      this.mistPositions = null;
      this.mistColors = null;
      this.mistStates = [];
    }
  }

  // ───────── Feature 6: Subtle Background ─────────

  private initBackground(): void {
    const size = 256;
    const data = new Uint8Array(size * size * 4);
    const half = size / 2;
    const rng = seededRandom(42);

    // Base: radial gradient dark purple
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x - half) / half;
        const dy = (y - half) / half;
        const dist = clamp01(Math.sqrt(dx * dx + dy * dy));

        const idx = (y * size + x) * 4;
        // 0x1a0e2a center -> 0x0a0515 edge
        data[idx] = Math.round(lerp(0x1a, 0x0a, dist));
        data[idx + 1] = Math.round(lerp(0x0e, 0x05, dist));
        data[idx + 2] = Math.round(lerp(0x2a, 0x15, dist));
        data[idx + 3] = 255;
      }
    }

    // Stars: ~150 randomly placed bright pixels
    for (let i = 0; i < 150; i++) {
      const sx = Math.floor(rng() * size);
      const sy = Math.floor(rng() * size);
      const brightness = 0.3 + rng() * 0.6; // 0.3-0.9
      const bVal = Math.round(brightness * 255);

      const idx = (sy * size + sx) * 4;
      data[idx] = bVal;
      data[idx + 1] = bVal;
      data[idx + 2] = Math.round(bVal * (0.9 + rng() * 0.1)); // slight blue tint
      data[idx + 3] = 255;

      // Brighter stars get 2x2 blocks
      if (brightness > 0.7) {
        const nx = Math.min(sx + 1, size - 1);
        const ny = Math.min(sy + 1, size - 1);
        for (const [bx, by] of [
          [nx, sy],
          [sx, ny],
          [nx, ny],
        ] as [number, number][]) {
          const bidx = (by * size + bx) * 4;
          data[bidx] = Math.round(bVal * 0.6);
          data[bidx + 1] = Math.round(bVal * 0.6);
          data[bidx + 2] = Math.round(bVal * 0.65);
          data[bidx + 3] = 255;
        }
      }
    }

    this.backgroundTexture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
    this.backgroundTexture.needsUpdate = true;

    this.backgroundMaterial = new MeshBasicMaterial({
      map: this.backgroundTexture,
      transparent: true,
      depthWrite: false,
      side: BackSide,
      opacity: 0.4,
    });

    this.backgroundGeometry = new SphereGeometry(300, 32, 32);
    this.backgroundMesh = new Mesh(this.backgroundGeometry, this.backgroundMaterial);
    this.backgroundMesh.frustumCulled = false;
    this.scene.add(this.backgroundMesh);
  }

  // ───────── Public API ─────────

  setup(gridCenter: Vector3, gridRadius: number): void {
    if (this.settlementLight) {
      this.settlementLight.position.set(gridCenter.x, gridCenter.y + 3, gridCenter.z);
    }
    if (this.radialMesh) {
      this.radialMesh.position.set(gridCenter.x, -0.03, gridCenter.z);
    }
    if (this.backgroundMesh) {
      this.backgroundMesh.position.copy(gridCenter);
    }

    // Update fog center
    this.fogCenter.copy(gridCenter);

    // Initialize edge mist with grid dimensions
    this.initEdgeMist(gridCenter, gridRadius);
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  update(deltaTime: number): void {
    if (!this.enabled || this.reducedMotion) return;
    this.updateGroundFog(deltaTime);
    this.updateEdgeMist(deltaTime);
  }

  setTimeProgress(progress: number): void {
    this.timeProgress = progress;
    this.updateSettlementLightIntensity();
    this.updateRadialOpacity();
    this.updateBackgroundOpacity();
    this.updateFogTimeOfDay();
  }

  setWeatherIntensity(intensity: number): void {
    this.weatherIntensity = clamp01(intensity);
  }

  setWind(direction: Vector2, speed: number): void {
    this.windDirection.copy(direction);
    this.windSpeed = speed;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.applySettlementLightState();
    this.applyRadialState();
    this.applyBackgroundState();
    this.applyFogState();
    this.applyMistState();
  }

  setSettlementLightEnabled(enabled: boolean): void {
    this.settlementLightEnabled = enabled;
    this.applySettlementLightState();
  }

  setRadialGradientEnabled(enabled: boolean): void {
    this.radialEnabled = enabled;
    this.applyRadialState();
  }

  setBackgroundEnabled(enabled: boolean): void {
    this.backgroundEnabled = enabled;
    this.applyBackgroundState();
  }

  setFogEnabled(enabled: boolean): void {
    this.fogEnabled = enabled;
    this.applyFogState();
  }

  setEdgeMistEnabled(enabled: boolean): void {
    this.mistEnabled = enabled;
    this.applyMistState();
  }

  dispose(): void {
    if (this.settlementLight) {
      this.scene.remove(this.settlementLight);
      this.settlementLight.dispose();
      this.settlementLight = null;
    }
    if (this.radialMesh) {
      this.scene.remove(this.radialMesh);
      this.radialGeometry?.dispose();
      this.radialMaterial?.dispose();
      this.radialTexture?.dispose();
      this.radialMesh = null;
      this.radialGeometry = null;
      this.radialMaterial = null;
      this.radialTexture = null;
    }
    if (this.fogPoints) {
      this.scene.remove(this.fogPoints);
      this.fogGeometry?.dispose();
      this.fogMaterial?.dispose();
      this.fogPoints = null;
      this.fogGeometry = null;
      this.fogMaterial = null;
      this.fogPositions = null;
      this.fogStates = [];
    }
    this.disposeEdgeMist();
    if (this.backgroundMesh) {
      this.scene.remove(this.backgroundMesh);
      this.backgroundGeometry?.dispose();
      this.backgroundMaterial?.dispose();
      this.backgroundTexture?.dispose();
      this.backgroundMesh = null;
      this.backgroundGeometry = null;
      this.backgroundMaterial = null;
      this.backgroundTexture = null;
    }
  }

  // ───────── Internal helpers ─────────

  private getNightFactor(): number {
    // Night: progress 0-20 and 80-100 → factor 1.0
    // Day: progress 30-70 → factor 0.0
    // Transitions: 20-30 and 70-80
    const p = this.timeProgress;
    if (p <= 20 || p >= 80) return 1.0;
    if (p >= 30 && p <= 70) return 0.0;
    if (p > 20 && p < 30) return 1.0 - (p - 20) / 10;
    // p > 70 && p < 80
    return (p - 70) / 10;
  }

  /** Returns a factor 0-1 where 1 = dawn/dusk, 0 = noon/midnight */
  private getDawnDuskFactor(): number {
    const p = this.timeProgress;
    // Dawn: 20-30 → peaks at 25
    // Dusk: 70-80 → peaks at 75
    if (p >= 20 && p <= 30) {
      const t = (p - 20) / 10; // 0-1
      return 1.0 - Math.abs(t - 0.5) * 2; // peaks at 0.5 (progress=25)
    }
    if (p >= 70 && p <= 80) {
      const t = (p - 70) / 10;
      return 1.0 - Math.abs(t - 0.5) * 2; // peaks at 0.5 (progress=75)
    }
    return 0;
  }

  private updateSettlementLightIntensity(): void {
    if (!this.settlementLight) return;
    const nightFactor = this.getNightFactor();
    this.settlementLightBaseIntensity = lerp(0.3, 1.2, nightFactor);
    if (this.enabled && this.settlementLightEnabled) {
      this.settlementLight.intensity = this.settlementLightBaseIntensity;
    }
  }

  private applySettlementLightState(): void {
    if (!this.settlementLight) return;
    const active = this.enabled && this.settlementLightEnabled;
    this.settlementLight.visible = active;
    this.settlementLight.intensity = active ? this.settlementLightBaseIntensity : 0;
  }

  private updateRadialOpacity(): void {
    if (!this.radialMaterial) return;
    const nightFactor = this.getNightFactor();
    // Higher opacity at night
    this.radialMaterial.opacity = lerp(0.6, 1.0, nightFactor);
  }

  private applyRadialState(): void {
    if (!this.radialMesh) return;
    this.radialMesh.visible = this.enabled && this.radialEnabled;
  }

  private updateFogTimeOfDay(): void {
    // Dawn/dusk: thicker fog (0.2), noon: thinner (0.08)
    const dawnDusk = this.getDawnDuskFactor();
    this.fogBaseOpacity = lerp(0.08, 0.2, dawnDusk);
  }

  private applyFogState(): void {
    if (!this.fogPoints) return;
    this.fogPoints.visible = this.enabled && this.fogEnabled;
  }

  private applyMistState(): void {
    if (!this.mistPoints) return;
    this.mistPoints.visible = this.enabled && this.mistEnabled;
  }

  private updateBackgroundOpacity(): void {
    if (!this.backgroundMaterial) return;
    const nightFactor = this.getNightFactor();
    this.backgroundMaterial.opacity = lerp(0.4, 1.0, nightFactor);
  }

  private applyBackgroundState(): void {
    if (!this.backgroundMesh) return;
    this.backgroundMesh.visible = this.enabled && this.backgroundEnabled;
  }
}
