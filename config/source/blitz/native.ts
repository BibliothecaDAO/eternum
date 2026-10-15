import type { NativePreset } from "../common/native-preset";
import { nativeRuleConstants as rule } from "../../../contracts/l3/world-native/schema/client.gen";
import { realmResourcePool, relicRules } from "../common/native-data";
import { arenaModeRules, arenaCommandMask } from "../common/native-commands";
import { blitzBalance } from "./balance";

export const blitzPreset: NativePreset = {
  ledger: {
    protocolCutBps: 1000,
    mmrEnabled: true,
  },
  bitcoinEnabled: false,
  startingTroops: [],
  realmResources: realmResourcePool,
  relics: relicRules,
  supplies: blitzBalance.blitz!.exploration!.rewards!.map(({ rewardId, amount, probabilityBps }) => ({
    resource_type: rewardId!,
    amount: amount!,
    amount_max: amount!,
    weight: probabilityBps!,
  })),
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
  progression: null,
  discovery: null,
  labor: null,
  chests: null,
  board: null,
  research: [],
  depths: [],
};
