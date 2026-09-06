// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { Plane, Raycaster, Vector3 } from "three";

import { HexagonScene } from "./hexagon-scene";

function createSceneHarness(isHexInteractive: (hexCoords: { col: number; row: number }) => boolean) {
  const scene = Object.create(HexagonScene.prototype) as {
    handleMouseMove: (event: MouseEvent, raycaster: Raycaster) => void;
    hoverGroundIntersection: Vector3;
    hoverGroundPlane: Plane;
    interactiveHexManager: {
      onMouseMove: ReturnType<typeof vi.fn>;
      clearHover: ReturnType<typeof vi.fn>;
      isHexInteractive: typeof isHexInteractive;
    };
    onHexagonMouseMove: ReturnType<typeof vi.fn>;
    tryArmyRaycastFallback: ReturnType<typeof vi.fn>;
  };

  scene.hoverGroundIntersection = new Vector3();
  scene.hoverGroundPlane = new Plane(new Vector3(0, 1, 0), 0);
  scene.interactiveHexManager = {
    onMouseMove: vi.fn(() => null),
    clearHover: vi.fn(),
    isHexInteractive,
  };
  scene.onHexagonMouseMove = vi.fn();
  scene.tryArmyRaycastFallback = vi.fn(() => null);

  return scene;
}

function createGroundPlaneRaycaster(): Raycaster {
  return new Raycaster(new Vector3(0, 10, 0), new Vector3(0, -1, 0));
}

describe("HexagonScene hover fallback", () => {
  it.each([1, 2, 4])(
    "skips hover picking during a camera gesture with buttons=%i and resumes afterwards",
    (buttons) => {
      const scene = createSceneHarness(() => false);
      const raycaster = createGroundPlaneRaycaster();
      scene.handleMouseMove(new MouseEvent("mousemove", { buttons }), raycaster);
      expect(scene.interactiveHexManager.onMouseMove).not.toHaveBeenCalled();
      expect(scene.tryArmyRaycastFallback).not.toHaveBeenCalled();
      expect(scene.interactiveHexManager.clearHover).toHaveBeenCalledOnce();
      expect(scene.onHexagonMouseMove).toHaveBeenCalledWith(null);

      scene.handleMouseMove(new MouseEvent("mousemove"), raycaster);
      expect(scene.interactiveHexManager.onMouseMove).toHaveBeenCalledOnce();
    },
  );

  it("uses the army hit when the hex picker misses", () => {
    const scene = createSceneHarness(() => false);
    scene.tryArmyRaycastFallback.mockReturnValue({ col: 0, row: 0 });
    scene.handleMouseMove(new MouseEvent("mousemove"), createGroundPlaneRaycaster());
    expect(scene.onHexagonMouseMove).toHaveBeenCalledWith({
      hexCoords: { col: 0, row: 0 },
      position: expect.any(Vector3),
    });
  });

  it("uses the ground-plane hit for an interactive hex", () => {
    const scene = createSceneHarness(() => true);
    scene.handleMouseMove(new MouseEvent("mousemove"), createGroundPlaneRaycaster());
    expect(scene.onHexagonMouseMove).toHaveBeenCalledWith({
      hexCoords: expect.any(Object),
      position: expect.any(Vector3),
    });
  });
  it("clears hover when the ground-plane fallback lands outside interactive hexes", () => {
    const scene = createSceneHarness(() => false);

    scene.handleMouseMove(new MouseEvent("mousemove"), createGroundPlaneRaycaster());

    expect(scene.onHexagonMouseMove).toHaveBeenCalledWith(null);
  });
});
