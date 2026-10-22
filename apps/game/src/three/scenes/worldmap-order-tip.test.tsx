import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { useNamedTips } from "@/ui/design-system/kit/named-tips";
import { orderTip } from "@/ui/features/frontier/hud/order-tip";
import { type ActionPath, ActionType, type OrderRefusal } from "@bibliothecadao/eternum";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { PerspectiveCamera, type Raycaster, Vector2 } from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InputManager } from "../managers/input-manager";
import type { SceneManager } from "../scene-manager";
import { SceneName } from "../types";
import { PointerOrderTip } from "./worldmap-order-tip";

/** What the scene reads for the tile under the pointer, changed by each case as the game would change it. */
const tile = {
  path: undefined as ActionPath[] | undefined,
  refusal: undefined as OrderRefusal | undefined,
  /** Where the tile's line can stand on screen now; null where it cannot (the tile is off screen). */
  at: { x: 200, y: 200 } as { x: number; y: number } | null,
};

const pointer = new PointerOrderTip(
  () => {
    const tip = orderTip({
      path: tile.path,
      exploreStamina: 21,
      food: { wheat: 0, fish: 0 },
      explored: true,
      refusal: tile.refusal,
      staminaWait: undefined,
      site: undefined,
    });
    return tip && tile.at && { ...tip, at: tile.at };
  },
  () => {},
  (_, line) => tile.at && { line, cost: null, at: tile.at },
);

const shownAt = () => useTooltipStore.getState().tooltip?.fixed ?? null;

const shownLine = (): string | null => {
  const tooltip = useTooltipStore.getState().tooltip;
  // Each line of the tip as the player reads it, the order over its cost: "Move / 2 stamina".
  return tooltip
    ? renderToStaticMarkup(<>{tooltip.content}</>)
        .replace(/<\/span><span/g, "</span> / <span")
        .replace(/<[^>]+>/g, "")
    : null;
};

const crate = (): ActionPath[] => [
  { hex: { col: 0, row: 0 }, actionType: ActionType.Move },
  { hex: { col: 1, row: 0 }, actionType: ActionType.Chest },
];

const move = (staminaCost: number): ActionPath[] => [
  { hex: { col: 0, row: 0 }, actionType: ActionType.Move },
  { hex: { col: 1, row: 0 }, actionType: ActionType.Move, staminaCost },
];

describe("the line under a still pointer", () => {
  afterEach(() => {
    pointer.point(null);
    useTooltipStore.getState().setTooltip(null);
    Object.assign(tile, { path: undefined, refusal: undefined, at: { x: 200, y: 200 } });
  });

  it("names the new reason when the reason changes under it", () => {
    tile.refusal = { reason: "stamina", need: 21 };
    pointer.point({ col: 1, row: 0 });
    expect(shownLine()).toBe("Needs 21 stamina");

    tile.refusal = { reason: "food" };
    pointer.refresh();
    expect(shownLine()).toBe("Not enough food for the army");
  });

  it("names the order once the rules give one, and goes when they take it away with nothing to say", () => {
    tile.refusal = { reason: "stamina", need: 2 };
    pointer.point({ col: 1, row: 0 });

    Object.assign(tile, { refusal: undefined, path: move(2) });
    pointer.refresh();
    expect(shownLine()).toBe("Move / 2 stamina");

    tile.path = undefined;
    pointer.refresh();
    expect(shownLine()).toBeNull();
  });

  it("follows its tile across the screen as the camera moves", () => {
    tile.path = move(2);
    pointer.point({ col: 1, row: 0 });
    expect(shownAt()).toEqual({ x: 200, y: 200 });

    tile.at = { x: 400, y: 300 };
    pointer.refresh();
    expect(shownAt()).toEqual({ x: 400, y: 300 });
  });

  it("stays away once a click takes the tile, while the pointer rests on it, until the pointer leaves it", () => {
    tile.path = move(2);
    pointer.point({ col: 1, row: 0 });
    pointer.take();
    expect(shownLine()).toBeNull();

    tile.path = crate();
    pointer.refresh();
    expect(shownLine()).toBeNull();

    // The click's preview opening recolours the hover, and the scene points at the same tile again.
    pointer.point({ col: 1, row: 0 });
    expect(shownLine()).toBeNull();

    pointer.point({ col: 2, row: 0 });
    pointer.point({ col: 1, row: 0 });
    expect(shownLine()).toBe("Open crate");
  });

  it("says a refused order at the tile it was sent to, following the tile as the camera moves, until the pointer leaves it", () => {
    const refused = "Another action from this account was sent first, perhaps from another tab. Try again.";
    tile.path = move(2);
    pointer.point({ col: 1, row: 0 });
    pointer.take();
    pointer.sayRefusal({ col: 1, row: 0 }, refused);
    expect([shownLine(), shownAt()]).toEqual([refused, { x: 200, y: 200 }]);

    // The camera pans: the refusal stands where its tile stands now, in the same words.
    tile.at = { x: 400, y: 300 };
    pointer.refresh();
    expect([shownLine(), shownAt()]).toEqual([refused, { x: 400, y: 300 }]);

    // The tile leaves the screen, then comes back.
    tile.at = null;
    pointer.refresh();
    expect(shownLine()).toBeNull();
    tile.at = { x: 120, y: 80 };
    pointer.refresh();
    expect([shownLine(), shownAt()]).toEqual([refused, { x: 120, y: 80 }]);

    // The scene points at the same tile again while the pointer rests there: the refusal stays.
    pointer.point({ col: 1, row: 0 });
    expect(shownLine()).toBe(refused);

    pointer.point({ col: 2, row: 0 });
    expect(shownLine()).toBe("Move / 2 stamina");
  });

  it("takes the earlier refusal away for good when a new click takes the same tile", () => {
    tile.path = move(2);
    pointer.point({ col: 1, row: 0 });
    pointer.take();
    pointer.sayRefusal({ col: 1, row: 0 }, "movement tile occupied");
    expect(shownLine()).toBe("movement tile occupied");

    // The player clicks the same tile again without moving away: its preview or its order stands there now.
    pointer.take();
    expect(shownLine()).toBeNull();
    pointer.point({ col: 1, row: 0 });
    tile.at = { x: 400, y: 300 };
    pointer.refresh();
    expect(shownLine()).toBeNull();

    // This click's own order refused in turn says its own words.
    pointer.sayRefusal({ col: 1, row: 0 }, "Not enough stamina");
    expect([shownLine(), shownAt()]).toEqual(["Not enough stamina", { x: 400, y: 300 }]);
  });

  it("leaves another surface's tooltip in place of a refusal while the camera moves", () => {
    pointer.sayRefusal({ col: 1, row: 0 }, "movement tile occupied");
    const another = { content: "Wheat", fixed: { x: 10, y: 10 } };
    useTooltipStore.getState().setTooltip(another);

    tile.at = { x: 400, y: 300 };
    pointer.refresh();
    expect(useTooltipStore.getState().tooltip).toBe(another);
  });

  it("says nothing after the pointer leaves the map, whatever changes", () => {
    tile.path = move(2);
    pointer.point({ col: 1, row: 0 });
    pointer.point(null);
    pointer.refresh();
    expect(shownLine()).toBeNull();
  });
});

/** A HUD control with a name, under the app's one tooltip behaviour. */
const NamedControl = () => {
  useNamedTips();
  return <button aria-label="Wheat">grain</button>;
};

describe("the line when the pointer leaves the map for the HUD", () => {
  let canvas: HTMLCanvasElement;
  let host: HTMLDivElement;
  let root: Root;
  let input: InputManager;
  let nextFrame: FrameRequestCallback | undefined;

  const hudButton = () => host.querySelector("button")!;
  const restOnTile = () => {
    canvas.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 20, clientY: 20 }));
    nextFrame?.(0);
  };
  const leaveCanvas = () => canvas.dispatchEvent(new MouseEvent("mouseleave", { relatedTarget: hudButton() }));
  const overHudButton = () => {
    const over = new MouseEvent("pointerover", { bubbles: true, relatedTarget: canvas });
    Object.defineProperty(over, "pointerType", { value: "mouse" });
    act(() => hudButton().dispatchEvent(over));
  };

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("requestAnimationFrame", (frame: FrameRequestCallback) => ((nextFrame = frame), 1));
    vi.stubGlobal("cancelAnimationFrame", () => (nextFrame = undefined));
    canvas = document.createElement("canvas");
    host = document.createElement("div");
    document.body.append(canvas, host);
    root = createRoot(host);
    act(() => root.render(<NamedControl />));
    tile.path = move(2);
    input = new InputManager(
      SceneName.WorldMap,
      { getCurrentScene: () => SceneName.WorldMap } as unknown as SceneManager,
      { setFromCamera: () => {} } as unknown as Raycaster,
      new Vector2(),
      new PerspectiveCamera(),
    );
    input.setSurface(canvas);
    input.activate();
    // As the map scene listens: a move names the tile under the pointer, a leave names none.
    input.addListener("mousemove", () => pointer.point({ col: 1, row: 0 }));
    input.addListener("mouseleave", () => pointer.point(null));
  });

  afterEach(() => {
    input.destroy();
    pointer.point(null);
    act(() => root.unmount());
    canvas.remove();
    host.remove();
    vi.unstubAllGlobals();
    tile.path = undefined;
  });

  it("gives the tooltip to the HUD control and keeps it there through a refresh", () => {
    restOnTile();
    expect(shownLine()).toBe("Move / 2 stamina");

    leaveCanvas();
    overHudButton();
    expect(shownLine()).toBe("Wheat");

    tile.path = crate();
    pointer.refresh();
    expect(shownLine()).toBe("Wheat");
  });

  it("leaves the HUD control its name when the control takes the pointer before the map hears the leave", () => {
    restOnTile();
    // Browsers send the control's pointerover before the canvas's mouseleave.
    overHudButton();
    leaveCanvas();
    expect(shownLine()).toBe("Wheat");

    pointer.refresh();
    expect(shownLine()).toBe("Wheat");
  });

  it("names the tile again when the pointer comes back to the map", () => {
    restOnTile();
    leaveCanvas();
    overHudButton();

    tile.path = crate();
    restOnTile();
    expect(shownLine()).toBe("Open crate");
  });
});
