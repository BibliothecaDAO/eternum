import type { LabScenario } from "./lab-chain";
import { oathSlotsScenario } from "./oath-slots-scenario";
import { labQuestRulesFact } from "./quest-scenario";
import { raceScenario } from "./race-scenario";
import { seedArmyRelics } from "./relics-scenario";

export function panelsScenario(): LabScenario {
  const scenario = oathSlotsScenario();
  scenario.store.applyFacts([...seedArmyRelics(scenario.startsAt), labQuestRulesFact()] as never);
  return {
    ...scenario,
    history: raceScenario().history?.slice(-8),
  };
}
