import { describe, expect, it, vi } from "vitest";

import { SelectedHexManager } from "./selected-hex-manager";

describe("SelectedHexManager", () => {
  it("disposes particle resources deterministically", () => {
    const subject = Object.create(SelectedHexManager.prototype) as SelectedHexManager & {
      particles: { dispose: () => void };
    };
    subject.particles = { dispose: vi.fn() };

    subject.dispose();

    expect(subject.particles.dispose).toHaveBeenCalledTimes(1);
  });
});
