import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ResourcesIds, RELICS } from "@bibliothecadao/types";
const mocks = vi.hoisted(() => ({ boost: undefined as any, tick: 1, effects: [] as any[] }));
vi.mock("@bibliothecadao/eternum", () => ({
  configManager: { getWonderBonusConfig: () => ({ bonusPercentNum: 2000 }) },
  getStructureRelicEffects: (_boost: any, tick: number) => mocks.effects.filter((effect) => effect.end > tick),
}));
vi.mock("@bibliothecadao/react", () => ({ useDojo: () => ({ setup: { components: {} } }) }));
vi.mock("@dojoengine/react", () => ({ useComponentValue: () => mocks.boost }));
vi.mock("@/sync/game-scope", () => ({ gameEntityKey: () => "realm" }));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useCurrentArmiesTick: () => mocks.tick }));
import { useProductionBonuses } from "./use-production-bonuses";
let root: Root, result: ReturnType<typeof useProductionBonuses>;
function Harness() {
  result = useProductionBonuses(5);
  return null;
}
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  Object.assign(mocks, { boost: undefined, tick: 1, effects: [] });
  root = createRoot(document.createElement("div"));
});
afterEach(async () => {
  await act(async () => root.unmount());
});
const render = () => act(async () => root.render(<Harness />));
it("uses neutral bonuses without active effects", async () => {
  await render();
  expect(result).toEqual({ wonderBonus: 1, productionBonus: 1, troopsBonus: 1 });
});
it("applies the existing relic bonus and expires it on army ticks", async () => {
  mocks.boost = { wonder_incr_percent_num: 2000 };
  mocks.effects = [{ id: ResourcesIds.ProductionRelic1, end: 3 }];
  await render();
  expect(result.wonderBonus).toBe(1.2);
  expect(result.productionBonus).toBe(
    Number(RELICS.find((relic) => relic.id === ResourcesIds.ProductionRelic1)!.bonus),
  );
  mocks.tick = 3;
  await render();
  expect(result.productionBonus).toBe(1);
});
