import type { NativePreset } from "../common/native-preset";
import { nativeRuleConstants as rule } from "../../../contracts/l3/world-native/schema/balance.gen";
import { realmResourcePool } from "../common/native-data";
import { arenaModeRules, arenaCommandMask } from "../common/native-commands";

export const blitzPreset: NativePreset = {
  orderAspects: [],
  deep: null,
  race: null,
  dailyQuest: null,
  banes: null,
  startingTroops: [],
  realmResources: realmResourcePool,
  bridgeResources: [],
  id: 2,
  gameType: "blitz",
  environmentGameType: "blitz",
  settlementMode: "Triple",
  modeRules: arenaModeRules,
  entryRule: rule.ENTRY_ROSTER,
  commandMask: arenaCommandMask,
  spacing: 6,
  dayUnitSeconds: 0,
  discovery: null,
  labor: null,
  chests: null,
  board: null,
  research: [],
  depths: [],
};
