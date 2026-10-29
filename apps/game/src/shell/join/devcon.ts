import { campaignHomeClaim, type LaborRuleAmounts } from "@bibliothecadao/eternum";
import { CAMPAIGNS, type CampaignKey } from "@realms-world/identity";

import { laborRulesOf } from "@/services/home-claim-rules";
import { frontierDevconPreset } from "../../../../../config/source/frontier/devcon";

/** The Devcon preset's LaborRules row, as the deployer writes it onchain for the Devcon season's games. */
export const DEVCON_LABOR_RULES: LaborRuleAmounts = laborRulesOf(frontierDevconPreset.labor);

const CAMPAIGN = "devcon-2026" satisfies CampaignKey;

/**
 * Devcon's campaign as its landing shows it: the campaign's public facts (@realms-world/identity's CAMPAIGNS, which the
 * identity Worker and the flyer generator read too) and what a ticket's home claims each Frontier day, by the same rule
 * the game's Realm sheet and the Day open push read it with (homeDailyClaim).
 */
export const DEVCON = {
  campaign: CAMPAIGN,
  path: CAMPAIGNS[CAMPAIGN].link,
  golden: CAMPAIGNS[CAMPAIGN].golden,
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
