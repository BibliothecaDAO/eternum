import { expect, it } from "vitest";
import { resolveExplorerTroops, staminaAt, affordableAt } from "@bibliothecadao/eternum/troop-stamina";
import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import { chainOf } from "./lab-chain";
import { staminaScenario } from "./stamina-scenario";

it.each([false, true])("shows the same effect-adjusted bar the signed skill command refills (wind=%s)", wind => {
  const scenario = staminaScenario(wind);
  const chain = chainOf(scenario);
  const army = chain.require("ExplorerTroops", { game_id: 1, explorer_id: SPIRE_ARMY });
  const troops = resolveExplorerTroops(chain, army)!;
  const rules = chain.require("SliceRules", { game_id: 1 }).troop_stamina_config;
  const amount = wind ? 60 : 50;
  expect(staminaAt(troops, scenario.startsAt, rules, 60).amount).toBe(BigInt(amount));
  expect(affordableAt(troops, scenario.startsAt, rules, 60, 140)).toBe(scenario.startsAt + (140 - amount) * (wind ? 3 : 6));
  const result = scenario.answer({ kind: "SpendSkillPoint", fields: {},
    calldata: ["1", "3", "0", "2", "0", String(SPIRE_ARMY), "0"] }, chain, scenario.startsAt);
  chain.applyFacts(result as never);
  expect(chain.require("ArmySlot", { game_id: 1, structure_id: army.owner, epoch: 1n, slot: 0 }).stamina.amount)
    .toBe(BigInt(amount + 30));
});
