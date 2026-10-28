import { entityHomeNamespace, expeditionRealmSite, readExpeditionRules } from "@bibliothecadao/eternum";

import { landAround, withoutArmies } from "./day-turn-scenario";
import type { LabFact, LabScenario } from "./lab-chain";
import { spireScenario } from "./spire-scenario";

/** How long before the season's first day the game opens (dev's game 6 was entered 7 s before): room for the boot. */
const SECONDS_BEFORE_THE_START = 30;

/**
 * A player in the season before its first day (/lab/game?scenario=season-opens), as a new player meets one they entered
 * early: realm 7 founded, no army out, and no site on the map until day 1 begins, when the day's turn brings the realm in
 * and the camera onto its site. The land round that site is revealed.
 */
export const seasonOpensScenario = (): LabScenario => {
  const spire = spireScenario();
  const rules = readExpeditionRules(spire.store, 1)!;
  const realm = spire.store.require("Structure", { game_id: 1, entity_id: 7 });
  const firstSite = expeditionRealmSite(rules, entityHomeNamespace(realm.entity_id), rules.startMainAt)!;
  const store = withoutArmies(spire.store);
  const unrevealed = (fact: LabFact) => {
    const { col, row } = fact.value as { col: number; row: number };
    return !store.get("TileOpt", { game_id: 1, alt: false, col, row });
  };
  store.applyFacts(landAround(firstSite, "0x1ab5").filter(unrevealed) as never);
  return { ...spire, store, startsAt: rules.startMainAt - SECONDS_BEFORE_THE_START, opensOn: firstSite };
};
