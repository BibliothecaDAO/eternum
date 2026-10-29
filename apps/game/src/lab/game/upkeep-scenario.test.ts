import { expect, it } from "vitest";
import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import { chainOf } from "./lab-chain";
import { upkeepScenario } from "./upkeep-scenario";

it("spends the fitting skill point for Battle, retaining earned XP and refilling the army", () => {
  const game = upkeepScenario();
  const chain = chainOf(game);
  const before = chain.require("ArmyProgress", { game_id: 1, explorer_id: BigInt(SPIRE_ARMY) });
  const result = game.answer(
    { kind: "SpendSkillPoint", fields: {}, calldata: ["1", "3", "0", "2", "0", String(SPIRE_ARMY), "0"] },
    chain,
    game.startsAt,
  );
  chain.applyFacts(result as never);
  const after = chain.require("ArmyProgress", { game_id: 1, explorer_id: BigInt(SPIRE_ARMY) });
  expect(after).toEqual({ ...before, battle: 2, uncommon_points: 0 });
  expect(chain.require("ExplorerTroops", { game_id: 1, explorer_id: BigInt(SPIRE_ARMY) }).troops.stamina).toMatchObject(
    { Inline: { amount: 70n } },
  );
});
