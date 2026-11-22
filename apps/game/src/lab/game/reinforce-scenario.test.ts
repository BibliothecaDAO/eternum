import { expect, it } from "vitest";
import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import { readReinforcePlan, reinforceRange } from "@/ui/features/frontier/army/reinforce-plan";
import { marchOn } from "@/ui/features/frontier/deploy/deploy-plan";
import { armyBar } from "@/ui/features/frontier/hud/dock-armies";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";

import { chainOf } from "./lab-chain";
import { SUPPLY_POST, supplyPostScenario } from "./supply-post-scenario";
import { reinforceScenario } from "./reinforce-scenario";

const PRECISION = BigInt(RESOURCE_PRECISION);
const ARMY = { game_id: 1, explorer_id: BigInt(SPIRE_ARMY) };

it("raises the troops into the army beside home, its realm paying them from its stock and their raise in wheat", () => {
  const game = reinforceScenario();
  const chain = chainOf(game);
  const realm = chain.require("Structure", { game_id: 1, entity_id: 7 });
  const before = readReinforcePlan(chain, realm, SPIRE_ARMY, game.startsAt)!;
  expect(before.current).toBe(1_498);
  const bar = armyBar(chain, chain.require("ExplorerTroops", ARMY), game.startsAt).stamina!;
  expect([bar.current, bar.perExplore]).toEqual([100, 20]);
  expect(reinforceRange(before, marchOn(bar, before.current))).toEqual({ troopsMax: 420, wheatMax: 404, max: 404 });

  const amount = 100n;
  chain.applyFacts(
    game.answer(
      {
        kind: "ManageTroops",
        fields: {},
        span: ["0", "2", String(SPIRE_ARMY), String(amount * PRECISION), "1"],
      },
      chain,
      game.startsAt,
    ) as never,
  );
  const after = readReinforcePlan(chain, realm, SPIRE_ARMY, game.startsAt)!;
  expect(chain.require("ExplorerTroops", ARMY).troops.count).toBe(1_598n * PRECISION);
  expect(after.stock).toBe(before.stock - 100);
  expect(after.raise.wheat).toBe(before.raise.wheat - before.raise.wheatFor(100));
});

it("opens the supply-post game and charges reinforcement to the clearing home's stores", () => {
  const game = supplyPostScenario();
  const chain = chainOf(game);
  const realm = chain.require("Structure", { game_id: 1, entity_id: 7 });
  const before = readReinforcePlan(chain, realm, SPIRE_ARMY, game.startsAt)!;
  const command = {
    kind: "ManageTroops",
    fields: {},
    span: ["0", "2", String(SPIRE_ARMY), String(100n * PRECISION), "0", String(SUPPLY_POST)],
  };
  expect(() => game.answer({ ...command, span: [...command.span.slice(0, -2), "1"] }, chain, game.startsAt)).toThrow(
    "Army is not beside its supply source",
  );
  chain.applyFacts(game.answer(command, chain, game.startsAt) as never);
  const after = readReinforcePlan(chain, realm, SPIRE_ARMY, game.startsAt)!;
  expect(chain.require("ExplorerTroops", ARMY).troops.count).toBe(1598n * PRECISION);
  expect(after.stock).toBe(before.stock - 100);
  expect(after.raise.wheat).toBe(before.raise.wheat - before.raise.wheatFor(100));
  expect(chain.require("ExpeditionSite", { game_id: 1, entity_id: SUPPLY_POST }).clear?.home_id).toBe(7n);
});
