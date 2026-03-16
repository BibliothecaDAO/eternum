import { RainEffect } from "@/three/effects/rain-effect";
import { type RendererActiveMode } from "@/three/renderer-backend-v2";
import { AmbientParticleSystem } from "@/three/systems/ambient-particle-system";
import { type Camera, type Scene, Vector2, Vector3 } from "three";
import type { AtmosphereSnapshot } from "./atmosphere-controller";

export interface WorldWeatherFxBackend {
  readonly kind: "world-scene-weather";
  destroy(): void;
  setSnapshot(snapshot: AtmosphereSnapshot): void;
  update(deltaTime: number, camera: Camera, sceneTarget: Vector3): void;
}

class WorldSceneWeatherBackend implements WorldWeatherFxBackend {
  public readonly kind = "world-scene-weather" as const;

  private readonly rainEffect: RainEffect;
  private readonly ambientParticles: AmbientParticleSystem;
  private snapshot: AtmosphereSnapshot | null = null;
  private readonly windDirection = new Vector2(1, 0);

  constructor(private readonly scene: Scene) {
    this.rainEffect = new RainEffect(this.scene);
    this.rainEffect.setEnabled(false);
    this.ambientParticles = new AmbientParticleSystem(this.scene);
  }

  setSnapshot(snapshot: AtmosphereSnapshot): void {
    this.snapshot = snapshot;
  }

  update(deltaTime: number, _camera: Camera, sceneTarget: Vector3): void {
    if (!this.snapshot) {
      this.rainEffect.setEnabled(false);
      this.ambientParticles.setWeatherIntensity(0);
      return;
    }

    this.windDirection.set(this.snapshot.windDirection.x, this.snapshot.windDirection.y);
    this.rainEffect.setWindFromSystem(this.windDirection, this.snapshot.windSpeed);
    this.rainEffect.setIntensity(this.snapshot.rainIntensity);
    this.rainEffect.setEnabled(this.snapshot.rainIntensity > 0.05);
    this.rainEffect.update(deltaTime, sceneTarget);

    this.ambientParticles.setTimeProgress(this.snapshot.cycleProgress);
    this.ambientParticles.setWind(this.windDirection, this.snapshot.windSpeed);
    this.ambientParticles.setWeatherIntensity(this.snapshot.intensity);
    this.ambientParticles.update(deltaTime, sceneTarget);
  }

  destroy(): void {
    this.rainEffect.dispose();
    this.ambientParticles.dispose();
  }
}

export function createWorldWeatherFxBackend(input: {
  activeMode: RendererActiveMode;
  scene: Scene;
}): WorldWeatherFxBackend {
  return new WorldSceneWeatherBackend(input.scene);
}
