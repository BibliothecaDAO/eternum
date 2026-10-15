import { useUIStore } from "@/hooks/store/use-ui-store";
import type { ActionPath } from "@bibliothecadao/eternum";
import type { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetWorldmapEntityActions } from "./worldmap-interaction-state";
import { reportSelectedArmy } from "./worldmap-selected-army-report";

type Hex = { col: number; row: number };
type ProjectionListener = Parameters<WorldSpatialProjection["subscribe"]>[0];

/** The projection's armies by id, and its listeners, as the report reads them. */
const createProjection = () => {
  const armies = new Map<number, Hex>();
  const listeners = new Set<ProjectionListener>();
  return {
    getArmy: (entityId: number) => {
      const hex = armies.get(entityId);
      return hex ? ({ kind: "army", entityId, hexCoords: { alt: false, ...hex } } as never) : undefined;
    },
    subscribe: (listener: ProjectionListener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    moveArmy(entityId: number, hex: Hex) {
      armies.set(entityId, hex);
      listeners.forEach((listener) => listener([{ kind: "army" } as never]));
    },
  };
};

const offerOrdersOn = (tiles: number) =>
  useUIStore
    .getState()
    .updateEntityActionActionPaths(
      new Map(Array.from({ length: tiles }, (_, index) => [`${index}`, [] as ActionPath[]])),
    );

let page: { __eternumMapSelection?: unknown };
let stop: () => void = () => {};

beforeEach(() => {
  resetWorldmapEntityActions();
  // The map's tests run without a page: a window stands in for the one the report writes to.
  page = {};
  vi.stubGlobal("window", page);
});

afterEach(() => {
  stop();
  vi.unstubAllGlobals();
});

describe("the selected army's report", () => {
  it("names the selected army, where it stands and how many tiles it is offered an order on, as each changes", () => {
    const projection = createProjection();
    projection.moveArmy(7, { col: 10, row: 10 });
    stop = reportSelectedArmy(projection);
    const army = () => (page.__eternumMapSelection as { army: unknown }).army;
    expect(army()).toBeNull();

    useUIStore.getState().updateEntityActionSelectedEntityId(7);
    offerOrdersOn(6);
    expect(army()).toEqual({ id: 7, hex: { col: 10, row: 10 }, orders: 6 });

    // In flight: no orders; then the move applies and its orders are offered from the new hex.
    offerOrdersOn(0);
    expect(army()).toEqual({ id: 7, hex: { col: 10, row: 10 }, orders: 0 });
    projection.moveArmy(7, { col: 11, row: 10 });
    offerOrdersOn(4);
    expect(army()).toEqual({ id: 7, hex: { col: 11, row: 10 }, orders: 4 });

    useUIStore.getState().updateEntityActionSelectedEntityId(null);
    expect(army()).toBeNull();
  });

  it("reports no army for a selected structure, and keeps the other parts of the report", () => {
    page.__eternumMapSelection = { hex: { col: 1, row: 2 }, structure: null, ringedHexes: 3 };
    stop = reportSelectedArmy(createProjection());

    useUIStore.getState().updateEntityActionSelectedEntityId(42);
    expect(page.__eternumMapSelection).toEqual({
      hex: { col: 1, row: 2 },
      structure: null,
      ringedHexes: 3,
      army: null,
    });
  });
});
