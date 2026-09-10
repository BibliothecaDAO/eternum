import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BuildingType } from "@bibliothecadao/types";
const mocks = vi.hoisted(() => ({
  allowed: true,
  current: true,
  canSubmit: true,
  close: vi.fn(),
  place: vi.fn(),
  owner: 1n,
}));
vi.mock("@bibliothecadao/react", () => ({
  useDojo: () => ({ setup: { components: {} }, account: { account: { address: "0x1" } } }),
}));
vi.mock("@dojoengine/react", () => ({ useComponentValue: () => undefined }));
vi.mock("@bibliothecadao/eternum", () => ({
  getRealmInfo: () => ({ owner: mocks.owner, resources: [] }),
  getBuildingCosts: () => [{ resource: 1, amount: 10 }],
}));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useCurrentDefaultTick: () => 1 }));
vi.mock("@/hooks/store/use-ui-store", () => ({
  useUIStore: (select: any) => select({ useSimpleCost: true, setUseSimpleCost: vi.fn() }),
}));
vi.mock("@/hooks/store/use-popover-store", () => ({ usePopoverStore: { getState: () => ({ close: mocks.close }) } }));
vi.mock("@/sync/game-scope", () => ({ gameEntityKey: () => "entity", buildingEntityKey: () => "building" }));
vi.mock("@/utils/can-issue-orders", () => ({ canIssueOrders: () => mocks.allowed }));
vi.mock("@/config/game-modes/use-game-mode-config", () => ({ useGameModeConfig: () => ({}) }));
vi.mock("./construction-groups", () => ({
  getConstructionBuildingGroups: () => [{ label: "Economic", buildings: [1] }],
  resolveBuildingRequirements: () => [{ resource: 1, amount: 10, current: 25 }],
}));
vi.mock("./construction-buildability", () => ({
  resolveConstructionBuildability: () =>
    mocks.canSubmit ? { canSubmit: true } : { canSubmit: false, reason: "Insufficient resources to build." },
}));
import { usePlotConstruction } from "./use-plot-construction";
let root: Root, container: HTMLDivElement, form: ReturnType<typeof usePlotConstruction>;
function Harness() {
  form = usePlotConstruction({
    entityId: 5,
    spot: { col: 1, row: 2 },
    tileManager: { getHexCoords: () => ({ col: 10, row: 10 }), placeBuilding: mocks.place } as any,
    isCurrentTarget: () => mocks.current,
  });
  return null;
}
beforeEach(async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  Object.assign(mocks, { allowed: true, current: true, canSubmit: true, owner: 1n });
  container = document.createElement("div");
  root = createRoot(container);
  await act(async () => root.render(<Harness />));
});
afterEach(async () => {
  await act(async () => root.unmount());
});
it("rechecks affordability at submit and explains a changed balance inline", async () => {
  mocks.canSubmit = false;
  await act(async () => form.build(1 as BuildingType));
  expect(mocks.place).not.toHaveBeenCalled();
  expect(mocks.close).not.toHaveBeenCalled();
  expect(form.error).toBe("Insufficient resources to build.");
});
it.each(["allowed", "current"] as const)("prevents submission when %s changes", async (key) => {
  mocks[key] = false;
  await act(async () => form.build(1 as BuildingType));
  expect(mocks.place).not.toHaveBeenCalled();
});
it("uses TileManager once for the selected plot and closes on success", async () => {
  await act(async () => {
    await Promise.all([form.build(1 as BuildingType), form.build(1 as BuildingType)]);
  });
  expect(mocks.place).toHaveBeenCalledTimes(1);
  expect(mocks.place).toHaveBeenCalledWith({ address: "0x1" }, 5, 1, { col: 1, row: 2 }, true);
  expect(mocks.close).toHaveBeenCalledWith("plot-construction");
});
