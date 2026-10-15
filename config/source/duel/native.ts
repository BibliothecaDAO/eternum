import type { NativePreset } from "../common/native-preset";
import { nativeRuleConstants as rule } from "../../../contracts/l3/world-native/schema/client.gen";
import { realmResourcePool, relicRules } from "../common/native-data";
import { arenaModeRules, arenaCommandMask } from "../common/native-commands";
import { duelBalance } from "./balance";

export const duelPreset: NativePreset = {
  ledger: {
    protocolCutBps: 2000,
    mmrEnabled: true,
  },
  bitcoinEnabled: false,
  startingTroops: [],
  realmResources: realmResourcePool,
  relics: relicRules,
  supplies: duelBalance.blitz!.exploration!.rewards!.map(({ rewardId, amount, probabilityBps }) => ({
    resource_type: rewardId!,
    amount: amount!,
    amount_max: amount!,
    weight: probabilityBps!,
  })),
  bridgeResources: [],
  id: 4,
  gameType: "duel",
  environmentGameType: "blitz",
  settlementMode: "Duel",
  modeRules: arenaModeRules,
  entryRule: rule.ENTRY_ROSTER,
  commandMask: arenaCommandMask,
  spacing: 8,
  dayUnitSeconds: 0,
  progression: null,
  discovery: null,
  labor: null,
  chests: null,
  board: null,
  research: [],
  depths: [],
};
