import { beforeEach, describe, expect, it, vi } from "vitest";

const world = vi.hoisted(() => ({
  ui: { setSelectedBuildingHex: vi.fn(), setLeftNavigationView: vi.fn() },
  mayOrder: true,
}));

vi.mock("@/hooks/store/use-ui-store", () => ({ useUIStore: { getState: () => world.ui } }));
vi.mock("@/utils/can-issue-orders", () => ({ canIssueOrders: () => world.mayOrder }));

import { LeftView } from "@/types";

import type { RealmLand } from "./realm-facts";
import { tapRealmHex } from "./realm-selection";

const REALM = {
  realmId: 7,
  cells: [
    { col: 10, row: 10, plot: true },
    { col: 11, row: 10, plot: true },
    { col: 15, row: 10, plot: false },
  ],
  buildings: [{ col: 10, row: 10 }],
} as unknown as RealmLand;

beforeEach(() => {
  vi.clearAllMocks();
  world.mayOrder = true;
});

describe("a tap in the realm view", () => {
  it("picks a building and opens its panel, for a watcher too", () => {
    world.mayOrder = false;
    tapRealmHex(REALM, { col: 10, row: 10 });
    expect(world.ui.setSelectedBuildingHex).toHaveBeenCalledWith({ structureId: 7, innerCol: 10, innerRow: 10 });
    expect(world.ui.setLeftNavigationView).toHaveBeenCalledWith(LeftView.EntityView);
  });

  it("picks an open plot for whoever may give orders", () => {
    tapRealmHex(REALM, { col: 11, row: 10 });
    expect(world.ui.setSelectedBuildingHex).toHaveBeenCalledWith({ structureId: 7, innerCol: 11, innerRow: 10 });
  });

  it.each([
    ["an open plot tapped by a watcher", { col: 11, row: 10 }, false],
    ["ground that is no plot", { col: 15, row: 10 }, true],
    ["ground beyond the realm", { col: 40, row: 40 }, true],
  ])("puts the pick away for %s", (_what, hex, mayOrder) => {
    world.mayOrder = mayOrder;
    tapRealmHex(REALM, hex);
    expect(world.ui.setSelectedBuildingHex).toHaveBeenCalledWith(null);
    expect(world.ui.setLeftNavigationView).not.toHaveBeenCalled();
  });
});
