import { Scene, Vector2, Vector3 } from "three";
import { describe, expect, it, vi } from "vitest";
import { RainEffect } from "./rain-effect";

describe("RainEffect", () => {
  it("clamps weather intensity and updates material opacity", () => {
    const effect = new RainEffect(new Scene());

    effect.setIntensity(2);
    expect(effect.getIntensity()).toBe(1);
    expect((effect as any).rainMaterial.opacity).toBeCloseTo(0.9);

    effect.setIntensity(-1);
    expect(effect.getIntensity()).toBe(0);
    expect((effect as any).rainMaterial.opacity).toBeCloseTo(0);
  });

  it("translates all drop vertices when spawn center changes", () => {
    const effect = new RainEffect(new Scene());
    const positions = (effect as any).rainGeometry.attributes.position.array as Float32Array;
    const before = Array.from(positions.slice(0, 6));

    effect.setSpawnCenter(new Vector3(5, 12, -3)); // delta from default = (+5, +2, -3)

    expect(positions[0]).toBeCloseTo(before[0] + 5);
    expect(positions[1]).toBeCloseTo(before[1] + 2);
    expect(positions[2]).toBeCloseTo(before[2] - 3);
    expect(positions[3]).toBeCloseTo(before[3] + 5);
    expect(positions[4]).toBeCloseTo(before[4] + 2);
    expect(positions[5]).toBeCloseTo(before[5] - 3);
  });

  it("uses external wind input during updates", () => {
    const effect = new RainEffect(new Scene());

    effect.setWindFromSystem(new Vector2(1, 0), 1);
    effect.update(1);

    expect((effect as any).windTarget.x).toBeCloseTo(0.15);
    expect((effect as any).wind.x).toBeGreaterThan(0);
  });

  it("is idempotent on dispose", () => {
    const scene = new Scene();
    const effect = new RainEffect(scene);

    const geometryDisposeSpy = vi.spyOn((effect as any).rainGeometry, "dispose");
    const materialDisposeSpy = vi.spyOn((effect as any).rainMaterial, "dispose");
    const removeSpy = vi.spyOn(scene, "remove");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    effect.dispose();
    effect.dispose();

    expect(geometryDisposeSpy).toHaveBeenCalledTimes(1);
    expect(materialDisposeSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith("RainEffect already disposed, skipping cleanup");
  });
});
