import { campaignHomeClaim, type LaborRuleAmounts } from "@bibliothecadao/eternum";

import { frontierDevconPreset } from "../../../../../config/source/frontier/devcon";

/** The Devcon preset's LaborRules row, as the deployer writes it onchain for the Devcon season's games. */
export const DEVCON_LABOR_RULES: LaborRuleAmounts = {
  amount: frontierDevconPreset.labor.amount,
  campaign_essence: frontierDevconPreset.labor.campaignEssence,
  golden_amount: frontierDevconPreset.labor.goldenAmount,
  golden_essence: frontierDevconPreset.labor.goldenEssence,
};

/**
 * Devcon's campaign as its landing shows it: the identity Worker's campaign key (apps/realms/server/campaigns.ts), the
 * landing's address, how many tickets are golden, and what a ticket's home claims each Frontier day, by the same rule
 * the game's Realm sheet and the Day open push read it with (homeDailyClaim).
 */
export const DEVCON = {
  campaign: "devcon-2026",
  path: "/join/devcon",
  golden: 15,
  claim: (golden: boolean) => campaignHomeClaim(DEVCON_LABOR_RULES, golden),
} as const;

const KEY = `realms:campaign-code:${DEVCON.campaign}`;

/**
 * The code a flyer's QR brought, kept from the moment the landing opens until the ticket is redeemed: a sign-in leaves
 * the page (Discord, a phone's home-screen app reloading on its start page), and the code must outlive it.
 */
export const keepCampaignCode = (code: string) => {
  try {
    localStorage.setItem(KEY, code);
  } catch {
    // Without storage the code still rides in the landing's own address.
  }
};

export const keptCampaignCode = (): string | null => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

export const forgetCampaignCode = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing was kept.
  }
};
