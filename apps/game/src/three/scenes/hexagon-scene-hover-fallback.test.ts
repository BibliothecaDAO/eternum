// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { Plane, Raycaster, Vector3 } from "three";

import { HexagonScene } from "./hexagon-scene";

function createSceneHarness(isHexInteractive: (hexCoords: { col: number; row: number }) => boolean) {
  const scene = Object.create(HexagonScene.prototype) as {
    handleMouseMove: (event: MouseEvent, raycaster: Raycaster) => void;
    hoverGroundIntersection: Vector3;
    hoverGroundPlane: Plane;
    interactiveHexManager: { onMouseMove: ReturnType<typeof vi.fn>; isHexInteractive: typeof isHexInteractive };
    onHexagonMouseMove: ReturnType<typeof vi.fn>;
  };

  scene.hoverGroundIntersection = new Vector3();
  scene.hoverGroundPlane = new Plane(new Vector3(0, 1, 0), 0);
  scene.interactiveHexManager = {
    onMouseMove: vi.fn(() => null),
    isHexInteractive,
  };
  scene.onHexagonMouseMove = vi.fn();

  return scene;
}

function createGroundPlaneRaycaster(): Raycaster {
  return new Raycaster(new Vector3(0, 10, 0), new Vector3(0, -1, 0));
}

describe("HexagonScene hover fallback", () => {
  it("clears hover when the ground-plane fallback lands outside interactive hexes", () => {
    const scene = createSceneHarness(() => false);

    scene.handleMouseMove(new MouseEvent("mousemove"), createGroundPlaneRaycaster());

    expect(scene.onHexagonMouseMove).toHaveBeenCalledWith(null);
  });
});
