import { Color, Scene, Vector3 } from "three";
import { describe, expect, it, vi } from "vitest";

import { PathRenderer } from "./path-renderer";

describe("PathRenderer visibility wiring", () => {
  it("uses the explicitly assigned visibility manager for culling", () => {
    const subject = new PathRenderer();
    subject.initialize(new Scene());
    subject.createPath(1, [new Vector3(0, 0, 0), new Vector3(2, 0, 0)], new Color("#ffffff"));

    const visibilityManager = {
      isBoxVisible: vi.fn(() => false),
    };

    subject.setVisibilityManager(visibilityManager as never);
    (subject as any).lastCullFrame = 2;
    subject.update(0);

    expect(visibilityManager.isBoxVisible).toHaveBeenCalledTimes(1);
    expect((subject as any).culledPaths.has(1)).toBe(true);
  });
});
