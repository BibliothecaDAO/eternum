import { campaignHomeClaim, type LaborRuleAmounts } from "@bibliothecadao/eternum";
import { CAMPAIGNS, type CampaignKey, type CampaignOpening } from "@realms-world/identity";

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
  /** The address a friend's referral link opens, with the inviter's code after it. */
  referralPath: (code: string) => `${CAMPAIGNS[CAMPAIGN].link}/r/${code}`,
  closesAt: CAMPAIGNS[CAMPAIGN].redeemUntil,
  goldenAt: CAMPAIGNS[CAMPAIGN].referral.goldenAt,
  claim: (golden: boolean) => campaignHomeClaim(DEVCON_LABOR_RULES, golden),
} as const;

/** One key per kind of opening; the latest link opened replaces the other. */
const KEYS = {
  code: `realms:campaign-code:${DEVCON.campaign}`,
  referral: `realms:campaign-referral:${DEVCON.campaign}`,
} as const;

/**
 * The code a flyer's QR or a friend's referral link brought, kept from the moment the landing opens until the ticket is
 * redeemed: a sign-in leaves the page (Discord, a phone's home-screen app reloading on its start page), and the code
 * must outlive it.
 */
export const keepCampaignOpening = (opening: CampaignOpening) => {
  try {
    forgetCampaignOpening();
    if ("referral" in opening) localStorage.setItem(KEYS.referral, opening.referral);
    else localStorage.setItem(KEYS.code, opening.code);
  } catch {
    // Without storage the code still rides in the landing's own address.
  }
};

export const keptCampaignOpening = (): CampaignOpening | null => {
  try {
    const referral = localStorage.getItem(KEYS.referral);
    if (referral) return { referral };
    const code = localStorage.getItem(KEYS.code);
    return code ? { code } : null;
  } catch {
    return null;
  }
};

export const forgetCampaignOpening = () => {
  try {
    localStorage.removeItem(KEYS.code);
    localStorage.removeItem(KEYS.referral);
  } catch {
    // Nothing was kept.
  }
};
