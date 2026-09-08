// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ isSpectating: false, explicit: false, tooltip: null as any, setTooltip: vi.fn() }));
vi.mock("@/hooks/store/use-ui-store", () => ({ useUIStore: { getState: () => state } }));
vi.mock("@/hooks/store/use-tooltip-store", () => ({ useTooltipStore: { getState: () => state } }));
vi.mock("@/utils/spectator-session", () => ({ isExplicitSpectateSession: () => state.explicit }));
vi.mock("@bibliothecadao/eternum", () => ({
  ActionType: { CreateArmy: "create_army" },
  ActionPaths: {
    posKey: ({ col, row }: any) => `${col + 100},${row + 100}`,
    getActionType: (path: any[]) => path.at(-1)?.actionType,
  },
}));
import { resolveSpawnActionPath, showArmyDeploymentTooltip } from "./worldmap-army-deployment";

const spawn = [{ hex: { col: 101, row: 102 }, actionType: "create_army" }] as any;
const paths = new Map([
  ["101,102", spawn],
  ["102,102", [{ actionType: "help" }] as any],
]);
beforeEach(() => {
  state.isSpectating = false;
  state.explicit = false;
  state.tooltip = null;
  vi.clearAllMocks();
});

describe("world map deployment affordance", () => {
  it("resolves only create-army actions in normalized map coordinates", () => {
    expect(resolveSpawnActionPath({ col: 1, row: 2 }, paths)).toBe(spawn);
    expect(resolveSpawnActionPath({ col: 2, row: 2 }, paths)).toBeNull();
    expect(resolveSpawnActionPath({ col: 3, row: 2 }, paths)).toBeNull();
    expect(resolveSpawnActionPath(null, paths)).toBeNull();
  });
  it.each(["isSpectating", "explicit"] as const)("suppresses spawn actions and tooltips for %s", (key) => {
    state[key] = true;
    expect(resolveSpawnActionPath({ col: 1, row: 2 }, paths)).toBeNull();
    showArmyDeploymentTooltip({ x: 200, y: 200 });
    expect(state.setTooltip).not.toHaveBeenCalled();
  });
  it("uses the existing tooltip and clears only its own text", () => {
    showArmyDeploymentTooltip({ x: 200, y: 200 });
    expect(state.setTooltip).toHaveBeenCalledWith({
      content: "Deploy an army here. Right-click.",
      fixed: { x: 212, y: 158 },
    });
    state.tooltip = { content: "Another tooltip" };
    state.setTooltip.mockClear();
    showArmyDeploymentTooltip(null);
    expect(state.setTooltip).not.toHaveBeenCalled();
    state.tooltip = { content: "Deploy an army here. Right-click." };
    showArmyDeploymentTooltip(null);
    expect(state.setTooltip).toHaveBeenCalledWith(null);
  });
});
