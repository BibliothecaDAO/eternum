import { Vector2 } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WeatherManager, WeatherType } from "./weather-manager";
function fixture() {
  const wind = {
    update: vi.fn(),
    getState: () => ({ direction: new Vector2(1, 0), effectiveSpeed: 0.5 }),
    dispose: vi.fn(),
  };
  return { manager: new WeatherManager(wind as any) };
}
afterEach(() => vi.restoreAllMocks());
describe("weather fronts", () => {
  it("keeps cloudy weather dry while changing lighting, and storm drives rain and lightning together", () => {
    const { manager } = fixture();
    manager.setWeather(WeatherType.CLOUDY);
    expect(manager.getState()).toMatchObject({
      rainIntensity: 0,
      stormIntensity: 0,
      skyDarkness: 0.3,
      sunOcclusion: 0.5,
    });
    manager.setWeather(WeatherType.STORM);
    expect(manager.getState()).toMatchObject({
      rainIntensity: 1,
      stormIntensity: 1,
      sunOcclusion: 1,
      ambientBoost: 0.22,
    });
    manager.update(0);
    expect(manager.getState()).toMatchObject({ windX: 0.5, windZ: 0 });
  });
  it("builds cloud cover before rain and lightning and keeps retargeted transitions continuous", () => {
    const { manager } = fixture();
    manager.transitionToWeather(WeatherType.STORM);
    manager.update(10);
    expect(manager.getState().skyDarkness).toBeGreaterThan(0);
    expect(manager.getState().rainIntensity).toBe(0);
    expect(manager.getState().stormIntensity).toBe(0);
    manager.update(30);
    expect(manager.getState().type).toBe(WeatherType.STORM);
    manager.transitionToWeather(WeatherType.RAIN);
    const before = { ...manager.getState() };
    manager.update(0);
    expect(manager.getState()).toMatchObject({ rainIntensity: before.rainIntensity, skyDarkness: before.skyDarkness });
    manager.update(30);
    expect(manager.getState()).toMatchObject({ type: WeatherType.RAIN, stormIntensity: 0, rainIntensity: 0.7 });
    manager.transitionToWeather(WeatherType.SUNNY);
    manager.update(10);
    expect(manager.getState().rainIntensity).toBeGreaterThan(0);
    expect(manager.getState().rainIntensity).toBeLessThan(0.7);
    manager.update(25);
    expect(manager.getState()).toMatchObject({ type: WeatherType.SUNNY, rainIntensity: 0, skyDarkness: 0 });
  });
  it("uses variable dwell times and neighboring weather fronts instead of a fixed cycle", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const early = fixture().manager;
    vi.mocked(Math.random).mockReturnValue(0.999);
    const late = fixture().manager;
    early.update(301);
    late.update(301);
    expect(early.getState().isTransitioning).toBe(true);
    expect(late.getState().isTransitioning).toBe(false);
    early.update(25);
    expect(early.getState().type).toBe(WeatherType.CLOUDY);
    late.update(300);
    late.update(25);
    expect(late.getState().type).toBe(WeatherType.CLOUDY);
  });
  it("holds forced weather for phase comparisons until evolution is resumed", () => {
    const { manager } = fixture();
    manager.setWeather(WeatherType.RAIN);
    manager.update(1000);
    expect(manager.getState()).toMatchObject({ type: WeatherType.RAIN, isTransitioning: false });
    manager.setEvolving(true);
    manager.update(1000);
    expect(manager.getState().isTransitioning).toBe(true);
  });
});
