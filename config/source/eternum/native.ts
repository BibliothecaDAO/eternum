import type { NativePreset } from "../common/native-preset";
import { nativeRuleConstants as rule } from "../../../contracts/l3/world-native/schema/client.gen";
import { startingTroopsByBiome, realmResourcePool, relicRules, eternumExplorationRewards } from "../common/native-data";
import { commandMask } from "../common/native-commands";

export const eternumPreset: NativePreset = {
  ledger: {
    entryFee: 0,
    protocolCutBps: 0,
    swordPrice: 0,
    shieldPrice: 0,
    mmrEnabled: false,
    predictionFeeBps: 0,
    liabilityCap: 0,
    seed: 0,
  },
  bitcoinEnabled: true,
  startingTroops: startingTroopsByBiome,
  realmResources: realmResourcePool,
  relics: relicRules,
  supplies: eternumExplorationRewards(750).map((row) => ({
    ...row,
    amount_max: row.amount,
  })),
  bridgeResources: [
    ...Array.from({ length: 22 }, (_, index) => index + 1),
    ...Array.from({ length: 14 }, (_, index) => index + 24),
    58,
  ],
  id: 3,
  gameType: "eternum",
  environmentGameType: "eternum",
  settlementMode: "Single",
  modeRules: rule.DISCOVER_HYPERSTRUCTURES | rule.SPIRES | rule.SEASON_CLOSE | rule.DEV_VILLAGE_ENTRY,
  entryRule: rule.ENTRY_ENTITLEMENT,
  commandMask: commandMask(["EnterDepth", "BuyRealmUpgrade"]),
  spacing: 6,
  epochSeconds: 0,
  chests: null,
  board: null,
  depths: [],
};
