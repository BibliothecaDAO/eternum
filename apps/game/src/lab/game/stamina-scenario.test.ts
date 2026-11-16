import { expect, it } from "vitest";
import { resolveExplorerTroops, staminaAt, affordableAt } from "@bibliothecadao/eternum/troop-stamina";
import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import { chainOf } from "./lab-chain";
import { staminaScenario } from "./stamina-scenario";

it.each([false, true])("shows the effect-adjusted bar and exact time until affordable (wind=%s)", (wind) => {
  const scenario = staminaScenario(wind);
  const chain = chainOf(scenario);
  const army = chain.require("ExplorerTroops", { game_id: 1, explorer_id: SPIRE_ARMY });
  const troops = resolveExplorerTroops(chain, army)!;
  const rules = chain.require("SliceRules", { game_id: 1 }).troop_stamina_config;
  const amount = wind ? 60 : 50;
  expect(staminaAt(troops, scenario.startsAt, rules, 60).amount).toBe(BigInt(amount));
  expect(affordableAt(troops, scenario.startsAt, rules, 60, 140)).toBe(
    scenario.startsAt + (140 - amount) * (wind ? 3 : 6),
  );
});
