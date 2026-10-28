/**
 * Devcon's campaign as its landing shows it: the identity Worker's campaign key (apps/realms/server/campaigns.ts), the
 * landing's address, what each ticket's home claims each Frontier day and how many tickets are golden.
 */
export const DEVCON = {
  campaign: "devcon-2026",
  path: "/join/devcon",
  laborPerDay: 1_000,
  essencePerDay: 1_000,
  goldenLaborPerDay: 2_000,
  goldenEssencePerDay: 2_000,
  golden: 20,
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
