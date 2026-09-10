import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";

import { HoverHexManager } from "./hover-hex-manager";
import { SelectedHexManager } from "./selected-hex-manager";
import { resolveHoverVisualPalette } from "./worldmap-interaction-palette";

describe("SelectedHexManager", () => {
  it("draws the hover palette as an outline so selection and hover share one colour", () => {
    const apply = vi.spyOn(HoverHexManager.prototype, "applyHoverPalette");
    new SelectedHexManager(new THREE.Scene());
    const palette = apply.mock.calls[0][0];
    expect(palette).toEqual(resolveHoverVisualPalette({ hasSelection: false, preserveOutlineOnly: true }));
    expect(palette.visualMode).toBe("outline");
    expect(palette.rimColor).toBe(resolveHoverVisualPalette({ hasSelection: false }).rimColor);
    apply.mockRestore();
  });

  it("holds the outline while a selection exists and releases it on dispose", () => {
    const subject = Object.create(SelectedHexManager.prototype) as SelectedHexManager;
    const outline = { showHover: vi.fn(), hideHover: vi.fn(), update: vi.fn(), dispose: vi.fn() };
    Reflect.set(subject as object, "outline", outline);

    subject.setPosition(3, 4);
    subject.update(0.16);
    subject.resetPosition();
    subject.dispose();

    expect(outline.showHover).toHaveBeenCalledWith(3, 4);
    expect(outline.update).toHaveBeenCalledWith(0.16);
    expect(outline.hideHover).toHaveBeenCalledTimes(1);
    expect(outline.dispose).toHaveBeenCalledTimes(1);
  });
});
