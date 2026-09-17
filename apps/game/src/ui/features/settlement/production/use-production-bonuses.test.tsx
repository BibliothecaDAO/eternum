import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
const mocks = vi.hoisted(() => ({ bonus: undefined as NativeRows["ProductionBonus"] | undefined, tick: 1 }));
vi.mock("@bibliothecadao/eternum", () => ({ configManager: { getActiveGameId: () => 1 } }));
vi.mock("@bibliothecadao/react", () => ({ useNativeRow: () => mocks.bonus }));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useCurrentArmiesTick: () => mocks.tick }));
import { useProductionBonuses } from "./use-production-bonuses";
let root: Root, result: ReturnType<typeof useProductionBonuses>;
function Harness() {
  result = useProductionBonuses(5);
  return null;
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.assign(mocks, { bonus: undefined, tick: 1 });
  root = createRoot(document.createElement("div"));
});
afterEach(async () => {
  await act(async () => root.unmount());
});
const render = () => act(async () => root.render(<Harness />));
it("uses neutral bonuses without a bonus row", async () => {
  await render();
  expect(result).toEqual({ laborBonus: 1, productionBonus: 1, troopsBonus: 1 });
});
it("uses each recorded percentage through its inclusive end tick", async () => {
  mocks.bonus = {
    game_id: 1,
    entity_id: 5,
    incr_resource_rate_percent_num: 1234,
    incr_resource_rate_end_tick: 2,
    incr_labor_rate_percent_num: 5000,
    incr_labor_rate_end_tick: 3,
    incr_troop_rate_percent_num: 2000,
    incr_troop_rate_end_tick: 4,
  };
  mocks.tick = 2;
  await render();
  expect(result).toEqual({ productionBonus: 1.1234, laborBonus: 1.5, troopsBonus: 1.2 });
  mocks.tick = 3;
  await render();
  expect(result).toEqual({ productionBonus: 1, laborBonus: 1.5, troopsBonus: 1.2 });
  mocks.tick = 4;
  await render();
  expect(result).toEqual({ productionBonus: 1, laborBonus: 1, troopsBonus: 1.2 });
  mocks.tick = 5;
  await render();
  expect(result).toEqual({ productionBonus: 1, laborBonus: 1, troopsBonus: 1 });
});
