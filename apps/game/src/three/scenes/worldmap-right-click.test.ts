import { describe, expect, it, vi } from "vitest";
import { dispatchRightClick } from "./worldmap-right-click";

const SELECTED = 101;
const OTHER = 102;
const MINE = new Set([SELECTED, OTHER, 103]);

/**
 * A right-click with a holding selected (its deploy tiles drawn elsewhere: no order at the clicked holding), and what
 * opened: the order handling, the Transfer window, or the clicked holding's menu.
 */
const rightClick = (input: Partial<Parameters<typeof dispatchRightClick>[0]>) => {
  const effects = { order: vi.fn(), transfer: vi.fn(), menu: vi.fn() };
  dispatchRightClick(
    {
      orderAtTarget: false,
      armySelected: false,
      selectedHoldingId: SELECTED,
      clickedHoldingId: OTHER,
      canTransferBetween: (source, destination) => MINE.has(source) && MINE.has(destination),
      transfersAllowed: true,
      ...input,
    },
    effects,
  );
  const opened = Object.entries(effects).filter(([, effect]) => effect.mock.calls.length > 0);
  expect(opened).toHaveLength(1);
  return { opened: opened[0][0], with: opened[0][1].mock.calls[0] };
};

describe("a right-click on the world map", () => {
  it("opens the transfer from the selected holding to another of the player's", () => {
    expect(rightClick({})).toEqual({ opened: "transfer", with: [{ sourceId: SELECTED, destinationIds: [OTHER] }] });
  });

  it("opens the selected holding's own menu on itself, its deploy tiles drawn or not", () => {
    expect(rightClick({ clickedHoldingId: SELECTED }).opened).toBe("menu");
  });

  it("gives a selected army its order at the tile, its help on its own realm included", () => {
    expect(rightClick({ armySelected: true, orderAtTarget: true }).opened).toBe("order");
  });

  it("never makes a goods transfer of an army's right-click on a holding it has no order at", () => {
    expect(rightClick({ armySelected: true }).opened).toBe("menu");
  });

  it("sends a holding's own order at its deploy tile, and any tile that is not a holding, to the order handling", () => {
    expect(rightClick({ orderAtTarget: true, clickedHoldingId: null }).opened).toBe("order");
    expect(rightClick({ clickedHoldingId: null }).opened).toBe("order");
  });

  it("opens the clicked holding's menu when goods cannot go between the two", () => {
    expect(rightClick({ clickedHoldingId: 900 }).opened).toBe("menu");
    expect(rightClick({ selectedHoldingId: 0 }).opened).toBe("menu");
    expect(rightClick({ transfersAllowed: false }).opened).toBe("menu");
  });
});
