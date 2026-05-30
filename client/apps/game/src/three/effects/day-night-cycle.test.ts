import { AmbientLight, Color, DirectionalLight, Fog, HemisphereLight, Scene, Vector3 } from "three";
import { describe, expect, it, vi } from "vitest";
import { DayNightCycleManager } from "./day-night-cycle";

function createFixture() {
  const scene = new Scene();
  scene.background = new Color(0x111111);

  const directionalLight = new DirectionalLight(0xffffff, 2);
  directionalLight.position.set(1, 2, 3);
  directionalLight.target.position.set(0, 0, 1);

  const hemisphereLight = new HemisphereLight(0xaaaaaa, 0xbbbbbb, 1.5);
  const ambientLight = new AmbientLight(0xcccccc, 0.5);
  const fog = new Fog(0x222222, 5, 50);

  const manager = new DayNightCycleManager(scene, directionalLight, hemisphereLight, ambientLight, fog);
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

describe("DayNightCycleManager", () => {
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
    expect(fixture.manager.getTimeOfDay(80)).toBe("Evening");
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

  it("applies weather modulation to sun, ambient fill, and fog color without overriding fog range", () => {
    const fixture = createFixture();

    fixture.manager.update(37.5);
    const beforeSun = fixture.directionalLight.intensity;
    const beforeHemisphere = fixture.hemisphereLight.intensity;
    const beforeFogNear = fixture.fog.near;
    const beforeFogFar = fixture.fog.far;
    const beforeFogColor = fixture.fog.color.getHex();

    fixture.manager.applyWeatherModulation(0.8, 0.7, 0.6);

    expect(fixture.directionalLight.intensity).toBeLessThan(beforeSun);
    expect(fixture.hemisphereLight.intensity).toBeGreaterThan(beforeHemisphere);
    expect(fixture.fog.color.getHex()).not.toBe(beforeFogColor);
    expect(fixture.fog.near).toBe(beforeFogNear);
    expect(fixture.fog.far).toBe(beforeFogFar);
  });

  it("does not overwrite camera-owned fog near and far during the day-night update", () => {
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

    // Call again WITHOUT update() in between — should NOT darken further
    fixture.manager.applyWeatherModulation(0.5, 0, 0);
    const skyAfterSecond = (fixture.scene.background as Color).clone();

    expect(skyAfterSecond.getHex()).toBe(skyAfterFirst.getHex());
  });

  it("sky color recovers after update following applyWeatherModulation", () => {
    const fixture = createFixture();

    fixture.manager.update(37.5);
    const skyBeforeWeather = (fixture.scene.background as Color).getHex();

    fixture.manager.applyWeatherModulation(0.8, 0, 0);
    const skyDuringWeather = (fixture.scene.background as Color).getHex();
    expect(skyDuringWeather).not.toBe(skyBeforeWeather);

    // Next update() should restore the canonical sky color
    fixture.manager.update(37.5);
    const skyAfterRecovery = (fixture.scene.background as Color).getHex();
    expect(skyAfterRecovery).toBe(skyBeforeWeather);
  });

  it("applyWeatherModulation with skyDarkness=0 does not modify sky color", () => {
    const fixture = createFixture();

    fixture.manager.update(37.5);
    const skyBefore = (fixture.scene.background as Color).getHex();

    fixture.manager.applyWeatherModulation(0, 0, 0);
    const skyAfter = (fixture.scene.background as Color).getHex();

    expect(skyAfter).toBe(skyBefore);
  });

  it("getLastAmbientIntensity and getLastHemisphereIntensity return values from most recent updateLighting", () => {
    const fixture = createFixture();

    // Before any update, getters return 0 (initial field value)
    expect(fixture.manager.getLastAmbientIntensity()).toBe(0);
    expect(fixture.manager.getLastHemisphereIntensity()).toBe(0);

    // Update at day (progress 37.5) — should store the day-time intensities
    fixture.manager.update(37.5);
    const ambientAtDay = fixture.manager.getLastAmbientIntensity();
    const hemisphereAtDay = fixture.manager.getLastHemisphereIntensity();

    expect(ambientAtDay).toBeGreaterThan(0);
    expect(hemisphereAtDay).toBeGreaterThan(0);

    // The getter values should match the light objects (no flicker applied by the manager)
    expect(fixture.ambientLight.intensity).toBeCloseTo(ambientAtDay);
    expect(fixture.hemisphereLight.intensity).toBeCloseTo(hemisphereAtDay);

    // Update at deep night (progress 0) — intensities should change
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

  it("is idempotent on dispose", () => {
    const fixture = createFixture();
    const managerWithRestore = fixture.manager as unknown as { restoreOriginalLighting: () => void };
    const restoreSpy = vi.spyOn(managerWithRestore, "restoreOriginalLighting");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    fixture.manager.dispose();
    fixture.manager.dispose();

    expect(restoreSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith("DayNightCycleManager already disposed, skipping cleanup");
  });
});
