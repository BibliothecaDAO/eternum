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

    fixture.manager.setEnabled(false);

    expect(fixture.directionalLight.intensity).toBe(2);
    expect(fixture.directionalLight.position.x).toBeCloseTo(1);
    expect(fixture.directionalLight.position.y).toBeCloseTo(2);
    expect(fixture.directionalLight.position.z).toBeCloseTo(3);
    expect(fixture.hemisphereLight.intensity).toBe(1.5);
    expect(fixture.ambientLight.intensity).toBe(0.5);
    expect((fixture.scene.background as Color).getHex()).toBe(0x111111);
    expect(fixture.fog.near).toBe(5);
    expect(fixture.fog.far).toBe(50);
  });

  it("applies weather modulation to sun, ambient fill, and fog", () => {
    const fixture = createFixture();

    fixture.manager.update(37.5);
    const beforeSun = fixture.directionalLight.intensity;
    const beforeHemisphere = fixture.hemisphereLight.intensity;
    const beforeFogNear = fixture.fog.near;
    const beforeFogFar = fixture.fog.far;

    fixture.manager.applyWeatherModulation(0.8, 0.7, 0.6);

    expect(fixture.directionalLight.intensity).toBeLessThan(beforeSun);
    expect(fixture.hemisphereLight.intensity).toBeGreaterThan(beforeHemisphere);
    expect(fixture.fog.near).toBeLessThan(beforeFogNear);
    expect(fixture.fog.far).toBeLessThan(beforeFogFar);
  });

  it("is idempotent on dispose", () => {
    const fixture = createFixture();
    const restoreSpy = vi.spyOn(fixture.manager as any, "restoreOriginalLighting");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    fixture.manager.dispose();
    fixture.manager.dispose();

    expect(restoreSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith("DayNightCycleManager already disposed, skipping cleanup");
  });
});
