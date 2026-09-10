import { DirectionalLight, Scene, Vector3 } from "three";
import { RainEffect } from "../effects/rain-effect";
import { WorldAtmosphereController } from "../effects/world-atmosphere-controller";
import { ThunderBoltManager } from "../managers/thunderbolt-manager";
import { WeatherManager, WeatherType } from "../managers/weather-manager";
import { LightningEffectSystem } from "../scenes/lightning-effect-system";

/** The lab drives the game's effects, including evolving weather fronts. */
export class WeatherLabRuntime {
  private readonly rain: RainEffect;
  private readonly weather: WeatherManager;
  private readonly bolts: ThunderBoltManager;
  private readonly lightning: LightningEffectSystem;

  constructor(
    scene: Scene,
    sun: DirectionalLight,
    private controls: { target: Vector3 },
    sampleHeight?: (x: number, z: number) => number,
  ) {
    this.rain = new RainEffect(scene, sampleHeight);
    this.weather = new WeatherManager();
    this.bolts = new ThunderBoltManager(scene, controls, sampleHeight);
    this.bolts.setConfig({ radius: 1, count: 1 });
    this.lightning = new LightningEffectSystem({ scene, mainDirectionalLight: sun, thunderBoltManager: this.bolts });
    this.lightning.setup();
  }

  getWind() {
    return this.weather.getState();
  }

  setWeather(type: WeatherType): void {
    this.weather.setWeather(type);
  }
  setEvolving(enabled: boolean): void {
    this.weather.setEvolving(enabled);
  }
  strike(): void {
    this.bolts.spawnThunderBolts();
  }

  update(delta: number, atmosphere: WorldAtmosphereController): void {
    this.weather.update(delta);
    const state = this.weather.getState();
    atmosphere.applyWeatherModulation(state.skyDarkness, state.fogDensity, state.sunOcclusion, state.ambientBoost);
    const target = this.controls.target;
    this.rain.update(delta, target, state);
    this.lightning.update({
      stormIntensity: state.stormIntensity,
      cameraTargetX: target.x,
      cameraTargetY: target.y,
      cameraTargetZ: target.z,
      elapsedTime: performance.now() / 1000,
      stormDepth: state.intensity,
    });
    this.bolts.update();
  }

  dispose(): void {
    this.lightning.dispose();
    this.bolts.destroy();
    this.weather.dispose();
    this.rain.dispose();
  }
}
