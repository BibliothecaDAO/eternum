import { expect, it } from "vitest";

import { chainOf } from "./lab-chain";
import { LAB_SCENARIOS } from "./lab-games";

// Each lab game writes its facts over the spire's: a row written twice under two keys stops the game from opening.
it.each(Object.keys(LAB_SCENARIOS))("builds the %s lab game", (name) => {
  const scenario = LAB_SCENARIOS[name]!();
  const chain = chainOf(scenario);
  if (scenario.entersFromHome) {
    expect(chain.get("Structure", { game_id: 1, entity_id: 7 })).toBeUndefined();
    chain.applyFacts(
      scenario.answer({ kind: "SettleSeason", fields: {}, calldata: [] }, chain, scenario.startsAt) as never,
    );
  }
  expect(chain.require("Structure", { game_id: 1, entity_id: 7 }).entity_id).toBe(7n);
});
