// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { PerspectiveCamera, Raycaster, Vector2, Vector3 } from "three";
import { InputManager } from "../managers/input-manager";
import type { SceneManager } from "../scene-manager";
import { SceneName } from "../types";
import { HexagonScene } from "./hexagon-scene";

afterEach(() => vi.useRealTimers());

it("selects with short presses, then sends a held destination to the scene's order handler exactly once", () => {
  vi.useFakeTimers();
  const scene = Object.create(HexagonScene.prototype) as {
    handleClick: (event: MouseEvent, raycaster: Raycaster) => void;
    handleRightClick: (event: MouseEvent, raycaster: Raycaster) => void;
    handleDoubleClick: (event: MouseEvent, raycaster: Raycaster) => void;
    interactiveHexManager: { onClick: ReturnType<typeof vi.fn> };
    onHexagonClick: ReturnType<typeof vi.fn>;
    onHexagonRightClick: ReturnType<typeof vi.fn>;
    onHexagonDoubleClick: ReturnType<typeof vi.fn>;
  };
  const unit = { col: 1, row: 2 };
  const destination = { col: 2, row: 2 };
  scene.interactiveHexManager = { onClick: vi.fn(() => ({ hexCoords: unit, position: new Vector3() })) };
  scene.onHexagonClick = vi.fn();
  scene.onHexagonRightClick = vi.fn();
  scene.onHexagonDoubleClick = vi.fn();
  const surface = document.createElement("canvas");
  const manager = new InputManager(
    SceneName.WorldMap,
    { getCurrentScene: () => SceneName.WorldMap } as SceneManager,
    new Raycaster(),
    new Vector2(),
    new PerspectiveCamera(),
  );
  manager.setSurface(surface);
  manager.addListener("click", scene.handleClick.bind(scene));
  manager.addListener("contextmenu", scene.handleRightClick.bind(scene));
  manager.addListener("dblclick", scene.handleDoubleClick.bind(scene));
  manager.activate();
  const pointer = (type: string) =>
    surface.dispatchEvent(
      new PointerEvent(type, {
        pointerId: 1,
        pointerType: "touch",
        clientX: 100,
        clientY: 100,
        cancelable: true,
      }),
    );
  try {
    for (let tap = 0; tap < 2; tap++) {
      pointer("pointerdown");
      vi.advanceTimersByTime(50);
      pointer("pointerup");
    }
    expect(scene.onHexagonClick).toHaveBeenCalledTimes(2);
    expect(scene.onHexagonClick).toHaveBeenLastCalledWith(unit);
    expect(scene.onHexagonRightClick).not.toHaveBeenCalled();
    expect(scene.onHexagonDoubleClick).not.toHaveBeenCalled();

    scene.interactiveHexManager.onClick.mockReturnValue({ hexCoords: destination, position: new Vector3() });
    pointer("pointerdown");
    vi.advanceTimersByTime(500);
    pointer("pointerup");
    surface.dispatchEvent(new MouseEvent("click"));
    expect(scene.onHexagonClick).toHaveBeenCalledTimes(2);
    expect(scene.onHexagonRightClick).toHaveBeenCalledTimes(1);
    expect(scene.onHexagonRightClick).toHaveBeenCalledWith(expect.any(PointerEvent), destination);
  } finally {
    manager.destroy();
  }
});
