import { expect, it } from "vitest";
import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import { readReinforcePlan, reinforceRange } from "@/ui/features/frontier/army/reinforce-plan";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";

import { chainOf } from "./lab-chain";
import { reinforceScenario } from "./reinforce-scenario";

const PRECISION = BigInt(RESOURCE_PRECISION);
const ARMY = { game_id: 1, explorer_id: BigInt(SPIRE_ARMY) };

it("raises the troops into the army beside home, its realm paying them from its stock and their raise in wheat", () => {
  const game = reinforceScenario();
  const chain = chainOf(game);
  const realm = chain.require("Structure", { game_id: 1, entity_id: 7 });
  const before = readReinforcePlan(chain, realm, SPIRE_ARMY, game.startsAt)!;
  expect(before.current).toBe(1_498);
  expect(reinforceRange(before).max).toBeGreaterThan(0);

  const amount = 100n;
  chain.applyFacts(
    game.answer(
      {
        kind: "ManageTroops",
        fields: {},
        calldata: ["1", "0", "0", "3", "0", "2", String(SPIRE_ARMY), String(amount * PRECISION)],
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
