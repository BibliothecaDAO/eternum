import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Direction, GuardSlot, StructureType, TroopTier, TroopType } from "@bibliothecadao/types";

const mocks = vi.hoisted(() => ({
  createExplorer: vi.fn(async () => {}),
  addGuard: vi.fn(async () => {}),
  resource: { balance: 2000 },
  structure: {
    owner: 1n,
    base: {
      level: 0,
      category: 1,
      coord_x: 10,
      coord_y: 10,
      troop_max_explorer_count: 2,
      troop_explorer_count: 0,
      troop_max_guard_count: 1,
    },
  },
  needsBootstrap: false,
  guards: [] as any[],
  tiles: [{ occupierId: 0, hexCoords: { col: 11, row: 10 } }],
}));
const components = { Structure: "Structure", Resource: "Resource" };
const systemCalls = {};
vi.mock("@bibliothecadao/react", () => ({
  useDojo: () => ({ setup: { components, systemCalls }, account: { account: { address: "0x1" } } }),
}));
vi.mock("@dojoengine/react", () => ({
  useComponentValue: (component: string) => (component === "Structure" ? mocks.structure : mocks.resource),
}));
vi.mock("@/sync/game-scope", () => ({ gameEntityKey: () => "structure" }));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useCurrentArmiesTick: () => 1,
  useCurrentDefaultTick: () => 1,
}));
vi.mock("@/hooks/use-world-spatial-tiles", () => ({ useWorldSpatialTiles: () => mocks.tiles }));
vi.mock("@/ui/modules/entity-details/hooks/use-blitz-realm-provision", () => ({
  useBlitzRealmProvision: () => ({ needsBootstrap: mocks.needsBootstrap }),
}));
vi.mock("../../utils/guard-stamina", () => ({ getGuardStaminaSnapshot: () => null }));
vi.mock("@bibliothecadao/eternum", async () => {
  const types = await import("@bibliothecadao/types");
  return {
    ArmyManager: class {
      createExplorerArmy = mocks.createExplorer;
      addTroopsToGuard = mocks.addGuard;
    },
    configManager: { getMaxArmySize: () => 3000, getWorldStructureDefenseSlotsConfig: () => ({}) },
    divideByPrecision: (value: number) => Number(value),
    getBalance: () => ({ balance: mocks.resource.balance }),
    getGuardsByStructure: () => mocks.guards,
    getTroopResourceId: () => types.resources[0].id,
  };
});
vi.mock("@/hooks/store/use-ui-store", () => ({
  useUIStore: { getState: () => ({ bumpMilitaryMapVersion: vi.fn() }) },
}));
import { useArmyCreation } from "./use-army-creation";

let form: ReturnType<typeof useArmyCreation>;
let root: Root;
let container: HTMLDivElement;
const onSubmit = vi.fn();
const Harness = (props: { direction?: Direction; isExplorer?: boolean; initialGuardSlot?: number }) => {
  form = useArmyCreation({ structureId: 42, fixedContext: true, onSubmit, ...props });
  return null;
};

describe("shared army creation form", () => {
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    mocks.structure.base.category = StructureType.Realm;
    mocks.structure.base.troop_explorer_count = 0;
    mocks.resource = { balance: 2000 };
    mocks.needsBootstrap = false;
    mocks.guards = [];
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("keeps troop selection and count when reanchoring, then uses the existing explorer call", async () => {
    await act(async () => root.render(<Harness direction={Direction.EAST} />));
    await act(async () => {
      form.handleTroopSelect(TroopType.Knight, TroopTier.T2);
    });
    await act(async () => {
      form.handleTroopCountChange(500);
    });
    await act(async () => root.render(<Harness direction={Direction.WEST} />));
    expect(form.selectedTroopCombo).toEqual({ type: TroopType.Knight, tier: TroopTier.T2 });
    expect(form.troopCount).toBe(500);
    // A reanchored destination must still be free at submit time.
    expect(form.blockedReason).toBe("No free spawn hex.");
    await act(async () => root.render(<Harness direction={Direction.EAST} />));
    await act(async () => form.handleCreate());
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(mocks.createExplorer).toHaveBeenCalledWith(
      expect.objectContaining({ address: "0x1" }),
      TroopType.Knight,
      TroopTier.T2,
      500,
      Direction.EAST,
    );
    expect(mocks.addGuard).not.toHaveBeenCalled();
  });

  it("does not switch to guards when the explorer cap is reached", async () => {
    mocks.structure.base.troop_explorer_count = 2;
    await act(async () => root.render(<Harness direction={Direction.EAST} />));
    expect(form.armyType).toBe(true);
    expect(form.blockedReason).toBe("Field army cap reached.");
    await act(async () => form.handleCreate());
    expect(onSubmit).not.toHaveBeenCalled();
    expect(mocks.createExplorer).not.toHaveBeenCalled();
  });

  it("uses the preset guard slot and keeps an unavailable slot blocked", async () => {
    await act(async () => root.render(<Harness isExplorer={false} initialGuardSlot={GuardSlot.Alpha} />));
    expect(form.guardSlot).toBe(GuardSlot.Alpha);
    expect(form.blockedReason).toBe("No free guard slot.");
    await act(async () => root.render(<Harness isExplorer={false} initialGuardSlot={GuardSlot.Delta} />));
    await act(async () => form.handleTroopCountChange(2000));
    await act(async () => form.handleCreate());
    expect(mocks.addGuard).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      2000,
      GuardSlot.Delta,
    );
  });

  it("opens with every count at zero and keeps Deploy blocked until the player picks a count", async () => {
    await act(async () => root.render(<Harness direction={Direction.EAST} />));
    expect(form.troopCount).toBe(0);
    expect(form.maxAffordable).toBe(2000);
    expect(form.blockedReason).toBe("Choose a troop count.");
    await act(async () => form.handleCreate());
    expect(mocks.createExplorer).not.toHaveBeenCalled();
    await act(async () => form.handleTroopSelect(TroopType.Paladin, TroopTier.T1));
    expect(form.troopCount).toBe(0);
    await act(async () => form.handleTroopCountChange(form.maxAffordable));
    expect(form.blockedReason).toBeNull();
  });

  it("updates availability from the live resource row and explains provisioning first", async () => {
    await act(async () => root.render(<Harness direction={Direction.EAST} />));
    expect(form.maxAffordable).toBe(2000);
    mocks.resource = { balance: 0 };
    await act(async () => root.render(<Harness direction={Direction.EAST} />));
    expect(form.maxAffordable).toBe(0);
    expect(form.blockedReason).toBe("Not enough of this troop.");
    mocks.needsBootstrap = true;
    await act(async () => root.render(<Harness direction={Direction.EAST} />));
    expect(form.blockedReason).toBe("Structure not provisioned.");
  });
});
