import {
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Scene,
  Texture,
  TextureLoader,
  Vector3,
} from "three";
import { expect, it, vi } from "vitest";
import { WorldAtmosphereController } from "../effects/world-atmosphere-controller";
import { WeatherType } from "../managers/weather-manager";
vi.mock("../utils", () => ({ getWorldPositionForHex: () => new Vector3() }));
vi.mock("../constants", () => ({ HEX_SIZE: 1 }));
import { WeatherLabRuntime } from "./weather-lab-runtime";
it("modulates day and night lighting through the same weather state while keeping fill readable", () => {
  vi.spyOn(TextureLoader.prototype, "load").mockReturnValue(new Texture());
  const scene = new Scene();
  scene.background = new Color();
  const sun = new DirectionalLight(),
    hemi = new HemisphereLight(),
    ambient = new AmbientLight();
  const atmosphere = new WorldAtmosphereController(scene, sun, hemi, ambient, new Fog(0));
  const runtime = new WeatherLabRuntime(scene, sun, { target: new Vector3() });
  for (const phase of [0, 50]) {
    atmosphere.update(phase, undefined, { snap: true });
    runtime.setWeather(WeatherType.SUNNY);
    runtime.update(0, atmosphere);
    const clearSun = sun.intensity,
      clearAmbient = ambient.intensity;
    const moon = scene.children.find((light) => light instanceof DirectionalLight && light !== sun) as DirectionalLight;
    const clearMoon = moon.intensity;
    runtime.setWeather(WeatherType.CLOUDY);
    runtime.update(0, atmosphere);
    expect(sun.intensity).toBeLessThan(clearSun);
    expect(ambient.intensity).toBeGreaterThan(clearAmbient);
    expect(hemi.intensity).toBeGreaterThanOrEqual(1.6);
    if (phase === 0) expect(moon.intensity).toBeLessThan(clearMoon);
    else expect(moon.intensity).toBe(0);
  }
  runtime.dispose();
  atmosphere.dispose();
  vi.restoreAllMocks();
});
