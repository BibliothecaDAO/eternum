import { expect, it } from "vitest";

import { chainOf } from "./lab-chain";
import { LAB_SCENARIOS } from "./lab-games";

// Each lab game writes its facts over the spire's: a row written twice under two keys stops the game from opening.
// The settle game's player has no realm until they found it.
it.each(Object.keys(LAB_SCENARIOS))("builds the %s lab game", (name) => {
  const scenario = LAB_SCENARIOS[name]!();
  const chain = chainOf(scenario);
  if (name === "settle" || name === "aspect-settle") {
    expect(chain.get("Structure", { game_id: 1, entity_id: 7 })).toBeUndefined();
    chain.applyFacts(
      scenario.answer(
        {
          kind: "SettleSeason",
          fields: {},
          calldata: name === "aspect-settle" ? ["1", "0", "0", "0", "10", "1", "0", "3"] : [],
        },
        chain,
        scenario.startsAt,
      ) as never,
    );
  }
  if (name === "aspect-settle") {
    expect(chain.require("HomeAspect", { game_id: 1, home: 7 }).aspect).toBe(3);
    expect(chain.require("AspectMembers", { game_id: 1, aspect: 3 }).members).toBe(1);
  }
  expect(chain.require("Structure", { game_id: 1, entity_id: 7 }).entity_id).toBe(7n);
});
