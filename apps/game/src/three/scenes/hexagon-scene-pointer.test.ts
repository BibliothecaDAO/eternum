// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { Raycaster, Vector3 } from "three";

import { HexagonScene } from "./hexagon-scene";

type HexPosition = { col: number; row: number };

/** A scene whose pointer meets `standing` (a thing's tile, or none) before the ground at `ground` (or none). */
function createScene({ standing, ground }: { standing: HexPosition | null; ground: HexPosition | null }) {
  const scene = Object.create(HexagonScene.prototype) as {
    handleMouseMove: (event: MouseEvent, raycaster: Raycaster) => void;
    handleClick: (event: MouseEvent, raycaster: Raycaster) => void;
    handleRightClick: (event: MouseEvent, raycaster: Raycaster) => void;
    pickStandingThing: () => HexPosition | null;
    interactiveHexManager: {
      pick: ReturnType<typeof vi.fn>;
      showHover: ReturnType<typeof vi.fn>;
      clearHover: ReturnType<typeof vi.fn>;
      surfacePosition: (hex: HexPosition) => Vector3;
    };
    onHexagonMouseMove: ReturnType<typeof vi.fn>;
    onHexagonClick: ReturnType<typeof vi.fn>;
    onHexagonRightClick: ReturnType<typeof vi.fn>;
  };
  scene.pickStandingThing = () => standing;
  scene.interactiveHexManager = {
    pick: vi.fn(() => (ground ? { hexCoords: ground, position: new Vector3() } : null)),
    showHover: vi.fn(),
    clearHover: vi.fn(),
    surfacePosition: () => new Vector3(),
  };
  scene.onHexagonMouseMove = vi.fn();
  scene.onHexagonClick = vi.fn();
  scene.onHexagonRightClick = vi.fn();
  return scene;
}

const raycaster = () => new Raycaster(new Vector3(0, 10, 0), new Vector3(0, -1, 0));
const ARMY_TILE = { col: 4, row: 7 };
const TILE_BEHIND = { col: 4, row: 6 };

describe("the tile under the pointer", () => {
  it.each([1, 2, 4])("is none during a camera gesture (buttons=%i), and picked again after it", (buttons) => {
    const scene = createScene({ standing: null, ground: TILE_BEHIND });
    scene.handleMouseMove(new MouseEvent("mousemove", { buttons }), raycaster());
    expect(scene.interactiveHexManager.pick).not.toHaveBeenCalled();
    expect(scene.interactiveHexManager.clearHover).toHaveBeenCalledOnce();
    expect(scene.onHexagonMouseMove).toHaveBeenCalledWith(null);

    scene.handleMouseMove(new MouseEvent("mousemove"), raycaster());
    expect(scene.onHexagonMouseMove).toHaveBeenLastCalledWith({
      hexCoords: TILE_BEHIND,
      position: expect.any(Vector3),
    });
  });

  it("is the tile of the thing drawn under it, not the tile behind its model, for a hover, a click and a right-click", () => {
    const scene = createScene({ standing: ARMY_TILE, ground: TILE_BEHIND });
    scene.handleMouseMove(new MouseEvent("mousemove"), raycaster());
    scene.handleClick(new MouseEvent("click"), raycaster());
    scene.handleRightClick(new MouseEvent("contextmenu"), raycaster());
    expect(scene.interactiveHexManager.showHover).toHaveBeenCalledWith(ARMY_TILE);
    expect(scene.onHexagonMouseMove).toHaveBeenCalledWith({ hexCoords: ARMY_TILE, position: expect.any(Vector3) });
    expect(scene.onHexagonClick).toHaveBeenCalledWith(ARMY_TILE);
    expect(scene.onHexagonRightClick).toHaveBeenCalledWith(expect.any(MouseEvent), ARMY_TILE);
  });

  it("is the tile whose ground it is on where no thing is drawn under it", () => {
    const scene = createScene({ standing: null, ground: TILE_BEHIND });
    scene.handleMouseMove(new MouseEvent("mousemove"), raycaster());
    scene.handleClick(new MouseEvent("click"), raycaster());
    expect(scene.interactiveHexManager.showHover).toHaveBeenCalledWith(TILE_BEHIND);
    expect(scene.onHexagonClick).toHaveBeenCalledWith(TILE_BEHIND);
  });

  it("is none off the map's tiles, and lights none", () => {
    const scene = createScene({ standing: null, ground: null });
    scene.handleMouseMove(new MouseEvent("mousemove"), raycaster());
    scene.handleClick(new MouseEvent("click"), raycaster());
    expect(scene.interactiveHexManager.showHover).toHaveBeenCalledWith(null);
    expect(scene.onHexagonMouseMove).toHaveBeenCalledWith(null);
    expect(scene.onHexagonClick).toHaveBeenCalledWith(null);
  });
});
