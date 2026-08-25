import { afterEach, describe, expect, it, vi } from "vitest";

import { disposeContactShadowResources, getContactShadowResources } from "./contact-shadow";

describe("contact-shadow resource lifecycle", () => {
  afterEach(() => {
    // Ensure clean state between tests
    disposeContactShadowResources();
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
