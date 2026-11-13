import { nativeRuleConstants as rule } from "../../../contracts/l3/world-native/schema/client.gen";
import { commandMask } from "../common/native-commands";
import { eternumExplorationRewards, realmResourcePool, relicRules, startingTroopsByBiome } from "../common/native-data";
import type { NativePreset } from "../common/native-preset";

export const eternumPreset: NativePreset = {
  ledger: {
    protocolCutBps: 0,
    mmrEnabled: false,
  },
  bitcoinEnabled: true,
  startingTroops: startingTroopsByBiome,
  realmResources: realmResourcePool,
  relics: relicRules,
  supplies: eternumExplorationRewards(75).map((row) => ({
    ...row,
    percent_max: row.percent,
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
  modeRules:
    rule.DISCOVER_HYPERSTRUCTURES |
    rule.SPIRES |
    rule.SEASON_CLOSE |
    rule.DEV_VILLAGE_ENTRY |
    rule.COMBAT_DICE_ETHEREAL,
  entryRule: rule.ENTRY_ENTITLEMENT,
  commandMask: commandMask(["EnterDepth", "Research", "InteractSite"]),
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
