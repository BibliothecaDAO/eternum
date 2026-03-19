import { describe, expect, it, vi } from "vitest";

import { SelectedHexManager } from "./selected-hex-manager";

describe("SelectedHexManager", () => {
  it("disposes particle resources deterministically", () => {
    const subject = Object.create(SelectedHexManager.prototype) as SelectedHexManager;
    const particles = { dispose: vi.fn() };
    Reflect.set(subject as object, "particles", particles);

    subject.dispose();

    expect(particles.dispose).toHaveBeenCalledTimes(1);
  });
});
