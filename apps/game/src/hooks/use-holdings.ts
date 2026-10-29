import { useQuery } from "@tanstack/react-query";
import { IdentityRequestError, type CampaignKey, type CampaignTicket } from "@realms-world/identity";

import { identityClient, useIdentitySession } from "@/hooks/context/identity-session";
import { readHeldRealms } from "@/services/realm-entry";

/**
 * What the signed-in account holds outside a game, read once for every screen that shows it (a game's Realm step, the
 * player's card). Each read belongs to the account, and the Realms to its linked wallet too, so another account or a
 * changed wallet in the same tab asks again.
 */

/** The Realms the account's linked wallet holds (the relay's held-Realms read); not asked without a linked wallet. */
export const useHeldRealms = () => {
  const { session } = useIdentitySession();
  const wallet = session?.user.address ?? null;
  const held = useQuery({
    queryKey: ["held-realms", session?.user.realmsId ?? null, wallet] as const,
    queryFn: readHeldRealms,
    enabled: wallet !== null,
    retry: false,
    staleTime: 60_000,
  });
  return { session, wallet, held };
};

/** The ticket the account holds to this campaign: null when it holds none, undefined while that is not known yet. */
export const useHeldTicket = (campaign: CampaignKey | null) => {
  const { session } = useIdentitySession();
  const ticket = useQuery({
    queryKey: ["campaign-ticket", session?.user.realmsId ?? null, campaign] as const,
    queryFn: () => (campaign === null ? null : heldCampaignTicket(campaign)),
    enabled: session !== null && campaign !== null,
    retry: false,
    staleTime: 60_000,
  });
  return campaign === null ? null : ticket.data;
};

/** The ticket the account already holds to this campaign; null when it holds none. Opens no flyer. */
async function heldCampaignTicket(campaign: CampaignKey): Promise<CampaignTicket | null> {
  try {
    return await identityClient.redeemCampaignTicket(campaign, null);
  } catch (cause) {
    if (
      cause instanceof IdentityRequestError &&
      (cause.code === "invalid_redemption" || cause.code === "campaign_closed")
    )
      return null;
    throw cause;
  }
}
