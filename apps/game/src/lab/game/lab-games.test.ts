import { expect, it } from "vitest";

import { LAB_SCENARIOS } from "./lab-games";

// Each lab game writes its facts over the spire's: a row written twice under two keys stops the game from opening.
it.each(Object.keys(LAB_SCENARIOS))("builds the %s lab game", (name) => {
  const scenario = LAB_SCENARIOS[name]!();
  expect(scenario.store.get("Structure", { game_id: 1, entity_id: 7 })).toBeDefined();
});
