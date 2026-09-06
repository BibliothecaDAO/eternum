import { afterEach, describe, expect, it, vi } from "vitest";
import type { DataTexture } from "three";

import { disposeContactShadowResources, getContactShadowResources } from "./contact-shadow";

describe("contact-shadow resource lifecycle", () => {
  afterEach(() => {
    // Ensure clean state between tests
    disposeContactShadowResources();
  });

  it("provides a smooth radial mask without a canvas, with clear edges and an opaque center", () => {
    const texture = getContactShadowResources().material.map as DataTexture;
    expect(texture.isDataTexture).toBe(true);
    const { data, width, height } = texture.image;
    if (!data) throw new Error("Contact shadow texture has no mask data");
    expect(width).toBe(height);
    const alphaAt = (col: number, row: number) => data[(row * width + col) * 4 + 3];
    expect(alphaAt(0, 0)).toBe(0);
    expect(alphaAt(width / 2, height / 2)).toBeGreaterThan(245);
    let previousAlpha = 255;
    for (let col = width / 2; col < width; col += 1) {
      const alpha = alphaAt(col, height / 2);
      expect(alpha).toBeLessThanOrEqual(previousAlpha);
      expect(alpha).toBe(alphaAt(width - col - 1, height / 2));
      expect(alpha).toBe(alphaAt(height / 2, col));
      previousAlpha = alpha;
    }
    expect(previousAlpha).toBeLessThanOrEqual(2);
  });

  it("disposes geometry, material map, and material when resources exist", () => {
    const resources = getContactShadowResources();
    const geometryDispose = vi.spyOn(resources.geometry, "dispose");
    const materialDispose = vi.spyOn(resources.material, "dispose");
    const mapDispose = resources.material.map ? vi.spyOn(resources.material.map, "dispose") : null;

    disposeContactShadowResources();

    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    if (mapDispose) {
      expect(mapDispose).toHaveBeenCalledTimes(1);
    }
  });

  it("returns fresh objects after disposal", () => {
    const first = getContactShadowResources();
    disposeContactShadowResources();

    const second = getContactShadowResources();

    expect(second).not.toBe(first);
    expect(second.geometry).not.toBe(first.geometry);
    expect(second.material).not.toBe(first.material);
  });

  it("is idempotent — repeated disposal does not throw", () => {
    getContactShadowResources();
    disposeContactShadowResources();

    expect(() => disposeContactShadowResources()).not.toThrow();
    expect(() => disposeContactShadowResources()).not.toThrow();
  });

  it("returns the same cached instance on repeated calls without disposal", () => {
    const first = getContactShadowResources();
    const second = getContactShadowResources();

    expect(first).toBe(second);
  });
});
