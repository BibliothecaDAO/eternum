import type { NativePreset } from "../common/native-preset";
import { nativeRuleConstants as rule } from "../../../contracts/l3/world-native/schema/client.gen";
import { startingTroopsByBiome, realmResourcePool, relicRules } from "../common/native-data";
import { arenaModeRules, arenaCommandMask } from "../common/native-commands";
import { duelBalance } from "./balance";

export const duelPreset: NativePreset = {
  ledger: {
    entryFee: 500,
    protocolCutBps: 2000,
    swordPrice: 500,
    shieldPrice: 500,
    mmrEnabled: true,
    predictionFeeBps: 500,
    liabilityCap: 10000,
    seed: 100,
  },
  bitcoinEnabled: false,
  startingTroops: startingTroopsByBiome,
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
  epochSeconds: 0,
  progression: null,
  discovery: null,
  chests: null,
  board: null,
  depths: [],
};
