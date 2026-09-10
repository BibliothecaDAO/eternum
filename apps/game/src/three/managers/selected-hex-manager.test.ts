import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";

import { HoverHexManager } from "./hover-hex-manager";
import { SelectedHexManager } from "./selected-hex-manager";
import { resolveHoverVisualPalette } from "./worldmap-interaction-palette";

describe("SelectedHexManager", () => {
  it("draws the same filled hover look as the hex under the pointer", () => {
    const apply = vi.spyOn(HoverHexManager.prototype, "applyHoverPalette");
    new SelectedHexManager(new THREE.Scene());
    expect(apply.mock.calls[0][0]).toEqual(resolveHoverVisualPalette({ hasSelection: false }));
    expect(apply.mock.calls[0][0].visualMode).toBe("fill");
    apply.mockRestore();
  });

  it("holds the hover look and the particle ring while a selection exists and releases both", () => {
    const subject = Object.create(SelectedHexManager.prototype) as SelectedHexManager;
    const hover = { showHover: vi.fn(), hideHover: vi.fn(), update: vi.fn(), dispose: vi.fn() };
    const particles = { setPosition: vi.fn(), resetPosition: vi.fn(), update: vi.fn(), dispose: vi.fn() };
    Reflect.set(subject as object, "hover", hover);
    Reflect.set(subject as object, "particles", particles);
    Reflect.set(subject as object, "terrainSurface", { sampleSurface: () => ({ height: 2 }) });

    subject.setPosition(3, 4);
    subject.update(0.16);
    subject.resetPosition();
    subject.dispose();

    expect(hover.showHover).toHaveBeenCalledWith(3, 4);
    expect(particles.setPosition).toHaveBeenCalledWith(3, 2.1, 4);
    expect(hover.update).toHaveBeenCalledWith(0.16);
    expect(particles.update).toHaveBeenCalledWith(0.16);
    expect(hover.hideHover).toHaveBeenCalledTimes(1);
    expect(particles.resetPosition).toHaveBeenCalledTimes(1);
    expect(hover.dispose).toHaveBeenCalledTimes(1);
    expect(particles.dispose).toHaveBeenCalledTimes(1);
  });
});
