import { useQuery, useQueryClient } from "@tanstack/react-query";
import { IdentityRequestError, type CampaignKey, type CampaignTicket } from "@realms-world/identity";

import { identityClient, useIdentitySession } from "@/hooks/context/identity-session";
import { readHeldRealms } from "@/services/realm-entry";

/**
 * What the signed-in account holds outside a game, read once for every screen that shows it (a game's Realm step, the
 * player's card). Each read belongs to the account, and the Realms to its linked wallet too, so another account or a
 * changed wallet in the same tab asks again and never sees the last one's.
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

/**
 * The account's ticket to a campaign, as a screen can tell it: not answered yet, unreadable (with a way to ask again),
 * none (a confirmed answer: the only one that hides it), or held.
 */
export type HeldTicket =
  | { state: "unknown" }
  | { state: "unreadable"; retry: () => void }
  | { state: "none" }
  | { state: "held"; ticket: CampaignTicket };

export const useHeldTicket = (campaign: CampaignKey | null): HeldTicket => {
  const { session } = useIdentitySession();
  const ticket = useQuery({
    queryKey: heldTicketKey(session?.user.realmsId ?? null, campaign),
    queryFn: () => (campaign === null ? null : heldCampaignTicket(campaign)),
    enabled: session !== null && campaign !== null,
    retry: false,
    staleTime: 60_000,
  });
  if (campaign === null) return { state: "none" };
  if (ticket.isError) return { state: "unreadable", retry: () => void ticket.refetch() };
  if (ticket.data === undefined) return { state: "unknown" };
  return ticket.data ? { state: "held", ticket: ticket.data } : { state: "none" };
};

/**
 * Records a ticket the account has just opened (the Devcon landing), so every screen that shows the account's ticket
 * shows it at once rather than after its last answer goes stale. A read of that ticket that set out before the opening
 * answers for an earlier moment ("none"), so it is cancelled first: its answer, whenever it comes, never lands.
 */
export const useTicketOpened = () => {
  const client = useQueryClient();
  const { session } = useIdentitySession();
  return async (campaign: CampaignKey, ticket: CampaignTicket) => {
    const key = heldTicketKey(session?.user.realmsId ?? null, campaign);
    await client.cancelQueries({ queryKey: key, exact: true });
    client.setQueryData(key, ticket);
  };
};

const heldTicketKey = (realmsId: string | null, campaign: CampaignKey | null) =>
  ["campaign-ticket", realmsId, campaign] as const;

/** The ticket the account already holds to this campaign; null when it holds none. Opens no flyer. */
export async function heldCampaignTicket(campaign: CampaignKey): Promise<CampaignTicket | null> {
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
