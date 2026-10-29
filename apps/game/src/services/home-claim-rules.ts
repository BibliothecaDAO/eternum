import type { LaborRuleAmounts } from "@bibliothecadao/eternum";
import { CAMPAIGNS, type CampaignKey } from "@realms-world/identity";

import type { NativePreset } from "../../../../config/source/common/native-preset";
import { nativePresets } from "../../../../config/source/native";

/**
 * What a game's homes claim, known before the game's facts load: the LaborRules row its preset writes onchain, as the
 * deployer writes it. Presets are immutable, so a game's preset id names its rules for good.
 */
export const laborRulesOf = (labor: NonNullable<NativePreset["labor"]>): LaborRuleAmounts => ({
  amount: labor.amount,
  campaign_essence: labor.campaignEssence,
  golden_amount: labor.goldenAmount,
  golden_essence: labor.goldenEssence,
});

/** The LaborRules of a game of this preset; null, said aloud, for a preset this client does not know. */
export const presetLaborRules = (presetId: number): LaborRuleAmounts | null => {
  const preset = nativePresets[presetId];
  if (!preset) {
    console.error(`No native preset ${presetId} in this client: its homes' claims cannot be told.`);
    return null;
  }
  return preset.labor && laborRulesOf(preset.labor);
};

/** The campaign whose tickets found homes in this preset's games, if any (@realms-world/identity's CAMPAIGNS). */
export const campaignOfPreset = (presetId: number): CampaignKey | null =>
  (Object.keys(CAMPAIGNS) as CampaignKey[]).find((campaign) =>
    CAMPAIGNS[campaign].presets.some((preset) => preset === presetId),
  ) ?? null;
