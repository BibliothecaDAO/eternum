import { AmbientLight, DirectionalLight, PointLight, Scene } from "three";
import type { ThunderBoltManager } from "@/three/managers/thunderbolt-manager";

export interface LightningEffectDeps {
  scene: Scene;
  mainDirectionalLight: DirectionalLight;
  thunderBoltManager: ThunderBoltManager;
}

export class LightningEffectSystem {
  private stormLight!: PointLight;
  private ambientPurpleLight!: AmbientLight;

  // Lightning state
  private lightningEndTime = 0;
  private originalLightningIntensity = 0;
  private originalLightningColor = 0;
  private originalStormLightningIntensity = 0;
  private lastLightningTriggerProgress = -1;
  private lightningSequenceTimeout: NodeJS.Timeout | null = null;
  private lightningTriggerTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentStrikeIndex = 0;
  private readonly lightningStrikes: Array<{ delay: number; duration: number }> = [
    { delay: 0, duration: 80 },
    { delay: 200, duration: 60 },
    { delay: 450, duration: 100 },
    { delay: 700, duration: 40 },
  ];

  constructor(private readonly deps: LightningEffectDeps) {}

  setup(): void {
    this.ambientPurpleLight = new AmbientLight(0x3a1a3a, 0.1);
    this.deps.scene.add(this.ambientPurpleLight);

    this.stormLight = new PointLight(0xaa77ff, 1.5, 80);
    this.stormLight.position.set(0, 20, 0);
    this.deps.scene.add(this.stormLight);
  }

  getStormLight(): PointLight {
    return this.stormLight;
  }

  getAmbientPurpleLight(): AmbientLight {
    return this.ambientPurpleLight;
  }

  /** Returns true if lightning is currently active */
  get isLightningActive(): boolean {
    return this.lightningEndTime > 0;
  }

  /**
   * Check if lightning should end, trigger new lightning based on cycle progress,
   * and update storm light position/intensity.
   */
  update(params: {
    cycleProgress: number;
    cameraTargetX: number;
    cameraTargetY: number;
    cameraTargetZ: number;
    elapsedTime: number;
    stormDepth: number;
  }): void {
    const currentTime = performance.now();

    // Check if lightning should end
    if (this.lightningEndTime > 0 && currentTime >= this.lightningEndTime) {
      this.endLightning();
    }

    // Check for lightning trigger based on cycle timing
    this.shouldTriggerLightningAtCycleProgress(params.cycleProgress);

    // Position storm light to follow camera
    this.stormLight.position.set(params.cameraTargetX, params.cameraTargetY + 25, params.cameraTargetZ + 5);

    // Update storm light intensity when lightning is not active
    if (this.lightningEndTime === 0) {
      const baseStormIntensity = params.stormDepth > 0.05 ? 0.6 : 0.2;
      const stormIntensity = baseStormIntensity + Math.sin(params.elapsedTime * 0.3) * 0.15;
      this.stormLight.intensity = stormIntensity;
    }
  }

  private startLightningSequence(): void {
    if (this.lightningSequenceTimeout) {
      clearTimeout(this.lightningSequenceTimeout);
    }

    this.currentStrikeIndex = 0;
    this.executeNextStrike();
  }

  private executeNextStrike(): void {
    if (this.currentStrikeIndex >= this.lightningStrikes.length) {
      this.currentStrikeIndex = 0;
      return;
    }

    const strike = this.lightningStrikes[this.currentStrikeIndex];

    this.lightningSequenceTimeout = setTimeout(() => {
      this.triggerSingleLightningStrike(strike.duration);
      this.currentStrikeIndex++;
      this.executeNextStrike();
    }, strike.delay);
  }

  private triggerSingleLightningStrike(duration: number): void {
    const { mainDirectionalLight } = this.deps;

    // Store original values only once
    if (this.lightningEndTime === 0) {
      this.originalLightningIntensity = mainDirectionalLight.intensity;
      this.originalLightningColor = mainDirectionalLight.color.getHex();
      this.originalStormLightningIntensity = this.stormLight.intensity;
    }

    // Apply lightning effect
    mainDirectionalLight.intensity = 3.5;
    mainDirectionalLight.color.setHex(0xe6ccff);
    this.stormLight.intensity = 4;

    // Spawn thunder bolts
    this.deps.thunderBoltManager.spawnThunderBolts();

    // Set end time
    this.lightningEndTime = performance.now() + duration;
  }

  private endLightning(): void {
    const { mainDirectionalLight } = this.deps;

    mainDirectionalLight.intensity = this.originalLightningIntensity;
    mainDirectionalLight.color.setHex(this.originalLightningColor);
    this.stormLight.intensity = this.originalStormLightningIntensity;

    this.lightningEndTime = 0;
  }

  private shouldTriggerLightningAtCycleProgress(cycleProgress: number): boolean {
    const tolerance = 20;

    if (cycleProgress < tolerance && this.lastLightningTriggerProgress !== 0) {
      this.lastLightningTriggerProgress = 0;
      this.lightningTriggerTimeout = setTimeout(() => {
        this.startLightningSequence();
      }, 2000);
      return false;
    }

    if (cycleProgress > tolerance * 2) {
      this.lastLightningTriggerProgress = -1;
    }

    return false;
  }

  cleanup(): void {
    if (this.lightningTriggerTimeout) {
      clearTimeout(this.lightningTriggerTimeout);
      this.lightningTriggerTimeout = null;
    }
    if (this.lightningSequenceTimeout) {
      clearTimeout(this.lightningSequenceTimeout);
      this.lightningSequenceTimeout = null;
    }
    if (this.lightningEndTime > 0) {
      this.endLightning();
    }
    this.deps.thunderBoltManager.cleanup();
  }

  dispose(): void {
    this.cleanup();
    if (this.stormLight) {
      this.deps.scene.remove(this.stormLight);
    }
    if (this.ambientPurpleLight) {
      this.deps.scene.remove(this.ambientPurpleLight);
    }
  }
}
