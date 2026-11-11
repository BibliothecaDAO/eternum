import { ActionType, type ActionPath } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CENTRE = 100;
const VIEWER = 7n;

const world = vi.hoisted(() => ({
  ui: {
    entityActions: {
      selectedEntityId: null as number | null,
      actionPaths: new Map<string, unknown[]>(),
      hoveredHex: null as unknown,
    },
    selectOnMap: vi.fn(),
    updateEntityActionActionPaths: vi.fn(),
    updateEntityActionHoveredHex: vi.fn(),
  },
  offered: new Map<string, unknown[]>(),
  armyPaths: vi.fn(),
  moveArmy: vi.fn(),
  canIssueOrders: true,
  beforePlay: false,
  failed: vi.fn(),
  offerAtOutcome: (() => {}) as (explorerId: number) => void,
}));

vi.mock("@bibliothecadao/eternum", async (original) => ({
  ...(await original<typeof import("@bibliothecadao/eternum")>()),
  FELT_CENTER: () => 100,
  buildArmyPathIndexes: () => ({}),
  getBlockTimestamp: () => ({ currentDefaultTick: 1 }),
  getExplorerOwner: () => 7n,
  configManager: { getMapCenter: () => 100, getActiveGameId: () => 1 },
}));
vi.mock("@/hooks/store/use-account-store", () => ({ accountAddress: () => 7n }));
vi.mock("@/hooks/store/use-ui-store", () => ({ useUIStore: { getState: () => world.ui } }));
vi.mock("@/sync/active-game-client", () => ({
  requireActiveGameClient: () => ({ actions: { armyPaths: world.armyPaths, moveArmy: world.moveArmy } }),
}));
vi.mock("@/three/map-layer", () => ({ activeMapLayer: () => false }));
vi.mock("@/three/world-origin", () => ({ worldHexToWorld: (col: number, row: number) => ({ x: col, z: row }) }));
vi.mock("@/three/scenes/worldmap-army-order-selection", () => ({
  sendSelectedArmyTravel: (
    _explorerId: number,
    _order: unknown,
    send: () => Promise<unknown>,
    outcome: { applied(): void; refused(error: unknown): void },
  ) => void send().then(outcome.applied, outcome.refused),
  offerSelectedArmyOrdersAtOutcome: (offer: (explorerId: number) => void) => {
    world.offerAtOutcome = offer;
    return () => {};
  },
}));
vi.mock("@/ui/features/event-feed/notify", () => ({ toast: { failed: world.failed } }));
vi.mock("@/utils/can-issue-orders", () => ({
  canIssueOrders: () => world.canIssueOrders,
  refusedBeforePlay: () => world.beforePlay,
}));

import { ORDER_REQUEST_EVENT } from "@/three/scenes/worldmap-order-request";

import { MapSelection } from "./map-selection";

const ARMY = 42;
/** Contract hexes of a path from the army's hex, two steps east. */
const step = (col: number, actionType: ActionType) =>
  ({ hex: { col: CENTRE + col, row: CENTRE }, actionType }) as ActionPath;
const pathTo = (col: number, actionType: ActionType) => [
  step(0, ActionType.Move),
  step(1, ActionType.Move),
  step(col, actionType),
];
const keyOf = (col: number) => `${CENTRE + col},${CENTRE}`;

const projection = {
  getArmiesAtHex: ({ col }: { col: number }) => (col === CENTRE ? [{ entityId: ARMY }] : []),
  getStandingStructureAtHex: () => undefined,
} as unknown as WorldSpatialProjection;
const store = { get: () => ({ owner: VIEWER }) } as unknown as NativeFactStore;

let shown: number[][];
let selection: MapSelection;

/** The army is picked, and the rules offer it a move two hexes east and an attack three hexes east. */
function pickTheArmy(): void {
  world.offered = new Map([
    [keyOf(2), pathTo(2, ActionType.Move)],
    [keyOf(3), pathTo(3, ActionType.Attack)],
  ]);
  selection.tapAt({ col: 0, row: 0 });
  world.ui.entityActions.selectedEntityId = ARMY;
  world.ui.entityActions.actionPaths = world.offered;
}

beforeEach(() => {
  vi.clearAllMocks();
  world.ui.entityActions = { selectedEntityId: null, actionPaths: new Map(), hoveredHex: null };
  world.canIssueOrders = true;
  world.beforePlay = false;
  world.armyPaths.mockImplementation(() => ({ getPaths: () => world.offered }));
  world.moveArmy.mockResolvedValue({});
  shown = [];
  selection = new MapSelection(projection, store, (stops) => shown.push(Array.from(stops)));
});

afterEach(() => selection.dispose());

describe("a tap on the map", () => {
  it("picks the viewer's own army and offers it the orders the rules give it", () => {
    pickTheArmy();

    expect(world.ui.selectOnMap).toHaveBeenCalledWith({ kind: "army", entityId: ARMY, tile: "own" });
    expect(world.ui.updateEntityActionActionPaths).toHaveBeenCalledWith(world.offered);
  });

  it("pins a move on the hex tapped, shows its path, and sends nothing yet", () => {
    pickTheArmy();

    selection.tapAt({ col: 2, row: 0 });

    expect(world.ui.updateEntityActionHoveredHex).toHaveBeenLastCalledWith({ col: 2, row: 0 });
    expect(shown.at(-1)).toHaveLength(8);
    expect(world.moveArmy).not.toHaveBeenCalled();
  });

  it("sends the pinned order when the same hex is tapped again, and takes its path off the map", () => {
    pickTheArmy();
    selection.tapAt({ col: 2, row: 0 });

    selection.tapAt({ col: 2, row: 0 });

    expect(world.moveArmy).toHaveBeenCalledOnce();
    expect(world.moveArmy).toHaveBeenCalledWith({ explorerId: ARMY, path: world.offered.get(keyOf(2)) });
    expect(shown.at(-1)).toEqual([]);
  });

  it("does not send an attack: only a move or an explore is sent from this map", () => {
    pickTheArmy();

    selection.tapAt({ col: 3, row: 0 });
    selection.tapAt({ col: 3, row: 0 });

    expect(world.moveArmy).not.toHaveBeenCalled();
  });
});

describe("the HUD's verb", () => {
  const press = (col: number) =>
    window.dispatchEvent(new CustomEvent(ORDER_REQUEST_EVENT, { detail: { col, row: 0 } }));

  it("sends the picked army's order at the tile it names", () => {
    pickTheArmy();
    selection.tapAt({ col: 2, row: 0 });

    press(2);

    expect(world.moveArmy).toHaveBeenCalledOnce();
    expect(world.moveArmy).toHaveBeenCalledWith({ explorerId: ARMY, path: world.offered.get(keyOf(2)) });
  });

  it("sends nothing for a tile the rules offer no move to", () => {
    pickTheArmy();

    press(9);

    expect(world.moveArmy).not.toHaveBeenCalled();
  });

  it("sends nothing for a watcher, or before play has opened", () => {
    pickTheArmy();
    world.canIssueOrders = false;
    press(2);
    world.canIssueOrders = true;
    world.beforePlay = true;
    press(2);

    expect(world.moveArmy).not.toHaveBeenCalled();
  });

  it("is no longer heard once the map is gone", () => {
    pickTheArmy();
    selection.dispose();

    press(2);

    expect(world.moveArmy).not.toHaveBeenCalled();
  });
});

describe("an order's outcome", () => {
  it("tells the player when the order was refused", async () => {
    pickTheArmy();
    const refusal = new Error("not enough stamina");
    world.moveArmy.mockRejectedValueOnce(refusal);
    selection.tapAt({ col: 2, row: 0 });

    selection.tapAt({ col: 2, row: 0 });
    await vi.waitFor(() => expect(world.failed).toHaveBeenCalled());

    expect(world.failed).toHaveBeenCalledWith(refusal, "The order was not sent.");
  });

  it("offers the army its orders again from where it then stands", () => {
    pickTheArmy();
    world.armyPaths.mockClear();

    world.offerAtOutcome(ARMY);

    expect(world.armyPaths).toHaveBeenCalledOnce();
    expect(world.armyPaths.mock.calls[0][0]).toMatchObject({ explorerId: ARMY, playerAddress: VIEWER });
  });
});
