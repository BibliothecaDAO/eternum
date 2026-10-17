import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { orderTip } from "@/ui/features/frontier/hud/order-tip";
import { type ActionPath, ActionType, type OrderRefusal } from "@bibliothecadao/eternum";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { PointerOrderTip } from "./worldmap-order-tip";

/** What the scene reads for the tile under the pointer, changed by each case as the game would change it. */
const tile = {
  path: undefined as ActionPath[] | undefined,
  refusal: undefined as OrderRefusal | undefined,
  at: { x: 200, y: 200 },
};

const pointer = new PointerOrderTip(() => {
  const tip = orderTip({
    path: tile.path,
    target: null,
    exploreStamina: 21,
    food: { wheat: 0, fish: 0 },
    explored: true,
    refusal: tile.refusal,
    staminaWait: undefined,
    points: { exploreTile: 5, openRelicCrate: 250 },
    clickPreviews: false,
  });
  return tip && { ...tip, at: tile.at };
});

const shownLine = (): string | null => {
  const tooltip = useTooltipStore.getState().tooltip;
  return tooltip ? renderToStaticMarkup(<>{tooltip.content}</>).replace(/<[^>]+>/g, "") : null;
};

const move = (staminaCost: number): ActionPath[] => [
  { hex: { col: 0, row: 0 }, actionType: ActionType.Move },
  { hex: { col: 1, row: 0 }, actionType: ActionType.Move, staminaCost },
];

describe("the line under a still pointer", () => {
  afterEach(() => {
    pointer.point(null);
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
    expect(shownLine()).toBe("Right-click · Move · 2 stamina");

    tile.path = undefined;
    pointer.refresh();
    expect(shownLine()).toBeNull();
  });

  it("follows its tile across the screen as the camera moves", () => {
    tile.path = move(2);
    pointer.point({ col: 1, row: 0 });
    const before = useTooltipStore.getState().tooltip?.fixed;

    tile.at = { x: 400, y: 300 };
    pointer.refresh();
    const after = useTooltipStore.getState().tooltip?.fixed;
    expect({ x: after!.x - before!.x, y: after!.y - before!.y }).toEqual({ x: 200, y: 100 });
  });

  it("stays away once a click takes the tile, until the pointer comes to a tile again", () => {
    tile.path = move(2);
    pointer.point({ col: 1, row: 0 });
    pointer.take();
    expect(shownLine()).toBeNull();

    tile.path = move(3);
    pointer.refresh();
    expect(shownLine()).toBeNull();

    pointer.point({ col: 1, row: 0 });
    expect(shownLine()).toBe("Right-click · Move · 3 stamina");
  });

  it("says nothing after the pointer leaves the map, whatever changes", () => {
    tile.path = move(2);
    pointer.point({ col: 1, row: 0 });
    pointer.point(null);
    pointer.refresh();
    expect(shownLine()).toBeNull();
  });
});
