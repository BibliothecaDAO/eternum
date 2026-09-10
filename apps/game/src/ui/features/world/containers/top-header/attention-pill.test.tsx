vi.mock("@/three/constants", () => ({ HEX_SIZE: 1 }));
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ allowed: true, go: vi.fn(), open: vi.fn(), close: vi.fn(), state: {} as any }));
vi.mock("@/hooks/store/use-popover-store", () => ({
  usePopoverStore: { getState: () => ({ openSurface: mocks.open, close: mocks.close }) },
}));
vi.mock("../left-facets/use-empire-suggestions", () => ({ useEmpireSuggestions: () => [{ id: "build", realmId: 1 }] }));
vi.mock("../left-facets/suggestions-panel", () => ({ SuggestionsPanel: () => null }));
vi.mock("@/hooks/store/use-ui-store", () => ({ useUIStore: (select: any) => select(mocks.state) }));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useNowMs: () => 100000 }));
vi.mock("@/hooks/helpers/use-navigate", () => ({ useGoToStructure: () => mocks.go }));
vi.mock("@/utils/can-issue-orders", () => ({ canIssueOrders: () => mocks.allowed }));
vi.mock("@bibliothecadao/react", () => ({ useDojo: () => ({ setup: {} }) }));
vi.mock("@bibliothecadao/eternum", () => ({
  Position: class {
    constructor(public coords: any) {}
  },
}));
import { AttentionPill } from "./attention-pill";
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  mocks.allowed = true;
  mocks.state = {
    structureEntityId: 1,
    arrivedArrivalsNumber: 2,
    arrivedArrivalStructureIds: [3],
    playerStructures: [
      {
        entityId: 1,
        structure: { base: { coord_x: 10, coord_y: 11 }, troop_guards: { alpha: { battle_cooldown_end: 120 } } },
      },
      {
        entityId: 3,
        structure: { base: { coord_x: 20, coord_y: 21 }, troop_guards: { alpha: { battle_cooldown_end: 0 } } },
      },
    ],
  };
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
});
it("counts distinct attention targets and suggestions, then cycles without submitting orders", async () => {
  await act(async () => root.render(<AttentionPill />));
  expect(container.textContent).toBe("Attention3");
  expect(container.querySelector("button")?.className).toContain("bg-gold text-dark-brown");
  await act(async () => container.querySelector("button")!.click());
  expect(mocks.go).toHaveBeenLastCalledWith(1, expect.objectContaining({ coords: { x: 10, y: 11 } }), true);
  await act(async () => container.querySelector("button")!.click());
  expect(mocks.go).toHaveBeenLastCalledWith(3, expect.objectContaining({ coords: { x: 20, y: 21 } }), true);
  expect(mocks.open).not.toHaveBeenCalled();
  await act(async () => container.querySelector("button")!.click());
  expect(mocks.go).toHaveBeenLastCalledWith(1, expect.objectContaining({ coords: { x: 10, y: 11 } }), true);
  expect(mocks.open).toHaveBeenCalledWith(expect.objectContaining({ id: "suggestions", mapClick: "dismiss" }));
});
it("hides personal attention for a spectator", async () => {
  mocks.allowed = false;
  await act(async () => root.render(<AttentionPill />));
  expect(container.childElementCount).toBe(0);
});
