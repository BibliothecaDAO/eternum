import { CAMPAIGNS, type CampaignKey, type CampaignOpening } from "@realms-world/identity";

const CAMPAIGN = "devcon-2026" satisfies CampaignKey;

export const DEVCON = {
  campaign: CAMPAIGN,
  path: CAMPAIGNS[CAMPAIGN].link,
  /** The address a friend's referral link opens, with the inviter's code after it. */
  referralPath: (code: string) => `${CAMPAIGNS[CAMPAIGN].link}/r/${code}`,
  closesAt: CAMPAIGNS[CAMPAIGN].redeemUntil,
  /** A friend's ticket is golden 1 time in this many. */
  goldenOneIn: Math.round(1 / CAMPAIGNS[CAMPAIGN].referral.goldenOdds),
  /** Counted friends that turn the inviter's link golden. */
  goldenLinkAt: CAMPAIGNS[CAMPAIGN].referral.goldenLinkAt,
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
