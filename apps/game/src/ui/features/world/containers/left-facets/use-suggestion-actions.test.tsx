import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { BuildingType } from "@bibliothecadao/types";

const mocks = vi.hoisted(() => ({
  build: vi.fn(),
  upgrade: vi.fn(),
  navigate: vi.fn(),
  select: vi.fn(),
}));
vi.mock("@/utils/can-issue-orders", () => ({ canIssueOrders: () => true }));
vi.mock("@/config/game-modes/use-game-mode-config", () => ({ useGameModeConfig: () => ({ id: "blitz" }) }));
vi.mock("@/hooks/store/use-popover-store", () => ({
  usePopoverStore: (select: any) => select({ openSurface: vi.fn() }),
}));
vi.mock("@/hooks/helpers/use-navigate", () => ({ useGoToStructure: () => mocks.navigate }));
vi.mock("@/hooks/store/use-ui-store", () => ({
  useUIStore: (select: any) =>
    select({
      setStructureEntityId: mocks.select,
      setSelectedHex: mocks.select,
      setSelectedBuildingHex: mocks.select,
      setLeftNavigationView: mocks.select,
      useSimpleCost: false,
      playerStructures: [{ entityId: 7, structure: { base: { coord_x: 10, coord_y: 20 } } }],
    }),
}));
vi.mock("@/ui/features/settlement/construction/realm-build-actions", () => ({ buildRealmBuilding: mocks.build }));
vi.mock("@/ui/features/settlement", () => ({ ProductionModal: () => null }));
vi.mock("@/ui/modules/entity-details/hooks/use-realm-actions", () => ({
  useRealmActions: () => ({ fireUpgrade: mocks.upgrade }),
}));
vi.mock("@bibliothecadao/eternum", () => ({
  getRealmInfo: () => ({ position: { x: 10, y: 20 } }),
  Position: class {},
}));
vi.mock("@bibliothecadao/react", () => ({
  useGame: () => ({ setup: { store: {} } }),
  useQuery: () => ({ isMapView: true }),
}));
import { useSuggestionActions } from "./use-suggestion-actions";

it.each(["build-wood", "upgrade"])("runs %s without changing map, realm or building selection", async (action) => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  let actions!: ReturnType<typeof useSuggestionActions>;
  function Harness() {
    actions = useSuggestionActions();
    return null;
  }
  const root = createRoot(document.createElement("div"));
  try {
    await act(async () => root.render(<Harness />));
    await act(async () =>
      actions.handleSuggestionClick({
        id: "order",
        realmId: 7,
        action,
        buildingTypeHint: BuildingType.ResourceWood,
      } as any),
    );
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.select).not.toHaveBeenCalled();
    if (action === "upgrade") expect(mocks.upgrade).toHaveBeenCalledWith(7);
    else {
      expect(mocks.build).toHaveBeenCalledWith(expect.objectContaining({ entityId: 7 }));
      expect(mocks.build.mock.calls[0][0].onBuildSuccess).toBeUndefined();
    }
  } finally {
    await act(async () => root.unmount());
  }
});
