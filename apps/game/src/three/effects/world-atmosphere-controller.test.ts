import { AmbientLight, Color, DirectionalLight, Fog, HemisphereLight, Scene, Vector3 } from "three";
import { describe, expect, it, vi } from "vitest";
import { WorldAtmosphereController } from "./world-atmosphere-controller";

function createFixture() {
  const scene = new Scene();
  scene.background = new Color(0x111111);

  const directionalLight = new DirectionalLight(0xffffff, 2);
  directionalLight.position.set(1, 2, 3);
  directionalLight.target.position.set(0, 0, 1);

  const hemisphereLight = new HemisphereLight(0xaaaaaa, 0xbbbbbb, 1.5);
  const ambientLight = new AmbientLight(0xcccccc, 0.5);
  const fog = new Fog(0x222222, 5, 50);

  const manager = new WorldAtmosphereController(scene, directionalLight, hemisphereLight, ambientLight, fog);
  manager.params.progressSmoothing = 1;
  manager.params.sunPositionEasing = 1;
  manager.params.colorTransitionSpeed = 1;
  manager.params.transitionSmoothness = 0;

  return { manager, scene, directionalLight, hemisphereLight, ambientLight, fog };
}

function findMoonRimLight(scene: Scene, mainDirectionalLight: DirectionalLight): DirectionalLight | null {
  return (
    scene.children.find(
      (child): child is DirectionalLight => child instanceof DirectionalLight && child !== mainDirectionalLight,
    ) ?? null
  );
}

describe("WorldAtmosphereController", () => {
  it("uses the readability-first night preset", () => {
    const fixture = createFixture();
    const moonRimLight = findMoonRimLight(fixture.scene, fixture.directionalLight);

    fixture.manager.update(0);

    expect((fixture.scene.background as Color).getHex()).toBe(0x344562);
    expect(fixture.fog.color.getHex()).toBe(0x536b8c);
    expect(fixture.ambientLight.intensity).toBeCloseTo(0.56);
    expect(fixture.hemisphereLight.intensity).toBeCloseTo(1.05);
    expect(fixture.directionalLight.intensity).toBeCloseTo(1.85);
    expect(moonRimLight?.intensity).toBeCloseTo(0.56);
  });

  it("applies visibility floors to low lighting inputs", () => {
    const fixture = createFixture();
    const managerWithLighting = fixture.manager as unknown as {
      updateLighting(colors: {
        skyColor: number;
        groundColor: number;
        sunColor: number;
        ambientColor: number;
        fogColor: number;
        hemisphereIntensity: number;
        sunIntensity: number;
        ambientIntensity: number;
        fogNear: number;
        fogFar: number;
      }): void;
    };

    managerWithLighting.updateLighting({
      skyColor: 0x111111,
      groundColor: 0x111111,
      sunColor: 0xffffff,
      ambientColor: 0xffffff,
      fogColor: 0x111111,
      hemisphereIntensity: 0.1,
      sunIntensity: 0.1,
      ambientIntensity: 0.1,
      fogNear: 1,
      fogFar: 2,
    });

    expect(fixture.ambientLight.intensity).toBe(0.48);
    expect(fixture.hemisphereLight.intensity).toBe(0.95);
    expect(fixture.directionalLight.intensity).toBe(1.55);
  });

  it("updates lighting and sun target using cycle progress and camera target", () => {
    const fixture = createFixture();
    const cameraTarget = new Vector3(10, 2, 30);

    fixture.manager.update(50, cameraTarget);

    expect(fixture.directionalLight.position.y).toBeGreaterThanOrEqual(0.5);
    expect(fixture.directionalLight.target.position.x).toBeCloseTo(10);
    expect(fixture.directionalLight.target.position.y).toBeCloseTo(2);
    expect(fixture.directionalLight.target.position.z).toBeCloseTo(35.2);
    expect((fixture.scene.background as Color).getHex()).not.toBe(0x111111);
  });

  it("snaps the first update to the requested daylight phase instead of fading in from night", () => {
    const fixture = createFixture();
    fixture.manager.params.progressSmoothing = 0.02;
    fixture.manager.params.colorTransitionSpeed = 0.02;

    fixture.manager.update(50);

    expect((fixture.scene.background as Color).getHex()).toBe(0xb8d8f2);
    expect(fixture.ambientLight.intensity).toBeCloseTo(0.74);
    expect(fixture.hemisphereLight.intensity).toBeCloseTo(2.18);
    expect(fixture.directionalLight.intensity).toBeCloseTo(3.55);
  });

  it("snaps forced debug time previews even when live-cycle smoothing is slow", () => {
    const fixture = createFixture();
    fixture.manager.params.progressSmoothing = 0.02;
    fixture.manager.params.colorTransitionSpeed = 0.02;

    fixture.manager.update(0);
    fixture.manager.update(50, undefined, { snap: true });

    expect((fixture.scene.background as Color).getHex()).toBe(0xb8d8f2);
    expect(fixture.ambientLight.intensity).toBeCloseTo(0.74);
    expect(fixture.directionalLight.position.y).toBeCloseTo(12);
  });

  it("keeps evening key light above the horizon to avoid hard shadow curtains", () => {
    const fixture = createFixture();

    fixture.manager.update(83.3);

    expect(fixture.directionalLight.position.y).toBeCloseTo(6.96);
  });

  it("enables a cool moon rim light at night while keeping it off during day", () => {
    const fixture = createFixture();
    const moonRimLight = findMoonRimLight(fixture.scene, fixture.directionalLight);

    expect(moonRimLight).not.toBeNull();

    fixture.manager.update(40);
    expect(moonRimLight!.intensity).toBe(0);

    fixture.manager.update(90, new Vector3(5, 1, 8));
    expect(moonRimLight!.intensity).toBeGreaterThan(0);
    expect(moonRimLight!.color.getHex()).not.toBe(0xffffff);
  });

  it("clamps cycle speed and maps time-of-day buckets", () => {
    const fixture = createFixture();

    fixture.manager.setCycleSpeed(999);
    expect(fixture.manager.params.cycleSpeed).toBe(10);
    fixture.manager.setCycleSpeed(0);
    expect(fixture.manager.params.cycleSpeed).toBe(0.1);

    expect(fixture.manager.getTimeOfDay(5)).toBe("Night");
    expect(fixture.manager.getTimeOfDay(20)).toBe("Dawn");
    expect(fixture.manager.getTimeOfDay(40)).toBe("Day");
    expect(fixture.manager.getTimeOfDay(70)).toBe("Dusk");
    expect(fixture.manager.getTimeOfDay(80)).toBe("Dusk");
    expect(fixture.manager.getTimeOfDay(90)).toBe("Evening");
  });

  it("restores original lighting state when disabled", () => {
    const fixture = createFixture();

    fixture.manager.update(37.5, new Vector3(5, 1, 5));
    expect(fixture.directionalLight.intensity).not.toBe(2);
    fixture.fog.near = 18;
    fixture.fog.far = 72;

    fixture.manager.setEnabled(false);

    expect(fixture.directionalLight.intensity).toBe(2);
    expect(fixture.directionalLight.position.x).toBeCloseTo(1);
    expect(fixture.directionalLight.position.y).toBeCloseTo(2);
    expect(fixture.directionalLight.position.z).toBeCloseTo(3);
    expect(fixture.hemisphereLight.intensity).toBe(1.5);
    expect(fixture.ambientLight.intensity).toBe(0.5);
    expect((fixture.scene.background as Color).getHex()).toBe(0x111111);
    expect(fixture.fog.near).toBe(18);
    expect(fixture.fog.far).toBe(72);
  });

  it("applies capped weather modulation to sun, ambient fill, and fog color without overriding fog range", () => {
    const fixture = createFixture();

    fixture.manager.update(37.5);
    const beforeSun = fixture.directionalLight.intensity;
    const beforeSky = (fixture.scene.background as Color).clone();
    const beforeHemisphere = fixture.hemisphereLight.intensity;
    const beforeAmbient = fixture.ambientLight.intensity;
    const beforeFogNear = fixture.fog.near;
    const beforeFogFar = fixture.fog.far;
    const beforeFogColor = fixture.fog.color.clone();

    fixture.manager.applyWeatherModulation(1, 1, 1, 0.22);

    expect(fixture.directionalLight.intensity).toBeLessThan(beforeSun);
    expect(fixture.directionalLight.intensity).toBeCloseTo(beforeSun * 0.8);
    expect(fixture.hemisphereLight.intensity).toBeGreaterThan(beforeHemisphere);
    expect(fixture.ambientLight.intensity).toBeGreaterThan(beforeAmbient);
    expect((fixture.scene.background as Color).getHex()).toBe(beforeSky.multiplyScalar(0.76).getHex());
    expect(fixture.fog.color.getHex()).toBe(beforeFogColor.lerp(new Color(0x606880), 0.38).getHex());
    expect(fixture.fog.near).toBe(beforeFogNear);
    expect(fixture.fog.far).toBe(beforeFogFar);
  });

  it("does not overwrite camera-owned fog near and far during the atmosphere update", () => {
    const fixture = createFixture();
    fixture.fog.near = 24;
    fixture.fog.far = 81;

    fixture.manager.update(12.5, new Vector3(2, 1, 4));

    expect(fixture.fog.near).toBe(24);
    expect(fixture.fog.far).toBe(81);
  });

  it("applyWeatherModulation does not compound — calling twice without update yields same sky color", () => {
    const fixture = createFixture();

    fixture.manager.update(37.5);

    fixture.manager.applyWeatherModulation(0.5, 0, 0);
    const skyAfterFirst = (fixture.scene.background as Color).clone();

    // Call again WITHOUT update() in between - should NOT darken further
    fixture.manager.applyWeatherModulation(0.5, 0, 0);
    const skyAfterSecond = (fixture.scene.background as Color).clone();

    expect(skyAfterSecond.getHex()).toBe(skyAfterFirst.getHex());
  });

  it("weather modulation does not compound across sky, fog, light, or rim values", () => {
    const fixture = createFixture();
    const moonRimLight = findMoonRimLight(fixture.scene, fixture.directionalLight);

    fixture.manager.update(0);

    fixture.manager.applyWeatherModulation(1, 1, 1, 0.22);
    const first = {
      ambient: fixture.ambientLight.intensity,
      fog: fixture.fog.color.getHex(),
      hemisphere: fixture.hemisphereLight.intensity,
      rim: moonRimLight?.intensity,
      sky: (fixture.scene.background as Color).getHex(),
      sun: fixture.directionalLight.intensity,
    };

    fixture.manager.applyWeatherModulation(1, 1, 1, 0.22);

    expect(fixture.ambientLight.intensity).toBe(first.ambient);
    expect(fixture.fog.color.getHex()).toBe(first.fog);
    expect(fixture.hemisphereLight.intensity).toBe(first.hemisphere);
    expect(moonRimLight?.intensity).toBe(first.rim);
    expect((fixture.scene.background as Color).getHex()).toBe(first.sky);
    expect(fixture.directionalLight.intensity).toBe(first.sun);
  });

  it("sky and fog color recover when weather modulation clears", () => {
    const fixture = createFixture();

    fixture.manager.update(37.5);
    const skyBeforeWeather = (fixture.scene.background as Color).getHex();
    const fogBeforeWeather = fixture.fog.color.getHex();

    fixture.manager.applyWeatherModulation(0.8, 0.8, 0);
    const skyDuringWeather = (fixture.scene.background as Color).getHex();
    const fogDuringWeather = fixture.fog.color.getHex();
    expect(skyDuringWeather).not.toBe(skyBeforeWeather);
    expect(fogDuringWeather).not.toBe(fogBeforeWeather);

    fixture.manager.applyWeatherModulation(0, 0, 0);
    const skyAfterRecovery = (fixture.scene.background as Color).getHex();
    const fogAfterRecovery = fixture.fog.color.getHex();
    expect(skyAfterRecovery).toBe(skyBeforeWeather);
    expect(fogAfterRecovery).toBe(fogBeforeWeather);
  });

  it("applyWeatherModulation with skyDarkness=0 does not modify sky color", () => {
    const fixture = createFixture();

    fixture.manager.update(37.5);
    const skyBefore = (fixture.scene.background as Color).getHex();

    fixture.manager.applyWeatherModulation(0, 0, 0);
    const skyAfter = (fixture.scene.background as Color).getHex();

    expect(skyAfter).toBe(skyBefore);
  });

  it("getLastAmbientIntensity and getLastHemisphereIntensity return values from the current atmosphere frame", () => {
    const fixture = createFixture();

    // Before any update, getters return 0 (initial field value)
    expect(fixture.manager.getLastAmbientIntensity()).toBe(0);
    expect(fixture.manager.getLastHemisphereIntensity()).toBe(0);

    // Update at day (progress 37.5) - should store the day-time intensities
    fixture.manager.update(37.5);
    const ambientAtDay = fixture.manager.getLastAmbientIntensity();
    const hemisphereAtDay = fixture.manager.getLastHemisphereIntensity();

    expect(ambientAtDay).toBeGreaterThan(0);
    expect(hemisphereAtDay).toBeGreaterThan(0);

    // The getter values should match the light objects (no flicker applied by the manager)
    expect(fixture.ambientLight.intensity).toBeCloseTo(ambientAtDay);
    expect(fixture.hemisphereLight.intensity).toBeCloseTo(hemisphereAtDay);

    // Update at deep night (progress 0) - intensities should change
    fixture.manager.update(0);
    const ambientAtNight = fixture.manager.getLastAmbientIntensity();
    const hemisphereAtNight = fixture.manager.getLastHemisphereIntensity();

    expect(ambientAtNight).not.toBeCloseTo(ambientAtDay);
    expect(hemisphereAtNight).not.toBeCloseTo(hemisphereAtDay);
  });

  it("getLastAmbientIntensity is stable across repeated reads (no drift)", () => {
    const fixture = createFixture();

    fixture.manager.update(37.5);
    const first = fixture.manager.getLastAmbientIntensity();

    // Simulate what storm flicker does: overwrite the light intensity
    fixture.ambientLight.intensity = first * 1.06;

    // Without calling update(), the getter should still return the pre-flicker value
    expect(fixture.manager.getLastAmbientIntensity()).toBe(first);
  });

  it("keeps weather ambient boost in the storm-flicker baseline", () => {
    const fixture = createFixture();

    fixture.manager.update(37.5);
    const baseAmbient = fixture.manager.getLastAmbientIntensity();

    fixture.manager.applyWeatherModulation(0.2, 0.2, 0.2, 0.22);
    const boostedAmbient = fixture.manager.getLastAmbientIntensity();

    expect(boostedAmbient).toBeCloseTo(baseAmbient + 0.22);
    expect(fixture.ambientLight.intensity).toBeCloseTo(boostedAmbient);

    fixture.ambientLight.intensity = boostedAmbient * 1.06;

    expect(fixture.manager.getLastAmbientIntensity()).toBeCloseTo(boostedAmbient);
  });

  it("is idempotent on dispose", () => {
    const fixture = createFixture();
    const managerWithRestore = fixture.manager as unknown as { restoreOriginalLighting: () => void };
    const restoreSpy = vi.spyOn(managerWithRestore, "restoreOriginalLighting");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    fixture.manager.dispose();
    fixture.manager.dispose();

    expect(restoreSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith("WorldAtmosphereController already disposed, skipping cleanup");
  });
});
