import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CAMPAIGNS, type CampaignKey } from "@realms-world/identity";
import { useEffect } from "react";

import { identityClient, useIdentitySession } from "@/hooks/context/identity-session";

/**
 * The signed-in account's referral link to a campaign, and what its friends earned it, read while the campaign still
 * gives tickets; each read settles what friends earned. A reward they earned is a new or golden ticket, so every screen
 * that shows the account's ticket (the home source picker, the holdings strip) asks for it again.
 */
export const useCampaignReferral = (campaign: CampaignKey) => {
  const { session } = useIdentitySession();
  const client = useQueryClient();
  const open = Date.now() / 1000 < CAMPAIGNS[campaign].redeemUntil;
  const referral = useQuery({
    queryKey: ["campaign-referral", session?.user.realmsId ?? null, campaign] as const,
    queryFn: () => identityClient.campaignReferral(campaign),
    enabled: session !== null && open,
    retry: false,
    staleTime: 60_000,
  });
  const earnedTicket = referral.data?.earned.ticket ?? false;
  const earnedGolden = referral.data?.earned.golden ?? false;
  useEffect(() => {
    if (earnedTicket || earnedGolden) void client.invalidateQueries({ queryKey: ["campaign-ticket"] });
  }, [client, earnedTicket, earnedGolden]);
  return { open: session !== null && open, referral };
};
