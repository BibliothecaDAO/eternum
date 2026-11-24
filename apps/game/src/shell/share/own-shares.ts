import {
  sharePathVia,
  type InvitedFriends,
  type JoinedShare,
  type ShareChannel,
  type DayShareMoment,
  type ShareTally,
} from "@realms-world/identity";
import { catalogAspectId } from "@bibliothecadao/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { identityClient, useIdentitySession } from "@/hooks/context/identity-session";

import { useOrderIntent } from "../play/order-intent";

/**
 * A player's shared links, and what they brought, are their account's alone. Every read of them keys its cache by the
 * signed-in Realms id, asks nothing without one, and drops every other account's entries once the account changes: a
 * second player on the same app never posts, publishes or reads the first one's.
 */
const OWN_SHARES = "own-shares";

const useShareOwner = (): string | null => {
  const owner = useIdentitySession().session?.user.realmsId ?? null;
  const client = useQueryClient();
  useEffect(() => {
    client.removeQueries({ queryKey: [OWN_SHARES], predicate: ({ queryKey }) => queryKey[1] !== owner });
  }, [client, owner]);
  return owner;
};

/**
 * The account's link for one moment, as each channel posts it: made once per moment by identity, so the sheet opened
 * again gets the same one. `posted` records the post; `publish` hands identity the card the link then unfurls as;
 * `failed` says identity refused or could not make it, and `retry` asks again.
 */
const useMadeLink = <Made extends { code: string }>(key: readonly unknown[], make: () => Promise<Made | null>) => {
  const owner = useShareOwner();
  const made = useQuery({
    queryKey: [OWN_SHARES, owner, ...key],
    queryFn: make,
    enabled: owner !== null,
    staleTime: ({ state }) => (state.data === null ? 0 : Number.POSITIVE_INFINITY),
    retry: 1,
  });
  const link = owner === null ? undefined : made.data;
  const code = link?.code;
  return {
    link,
    code,
    url: (via: ShareChannel) => new URL(code ? sharePathVia(code, via) : "/", window.location.origin).href,
    // A post that cannot be recorded is still posted; the tally misses it, the player does not.
    posted: () => void (code && identityClient.sharePosted(code).catch(() => undefined)),
    publish: (card: Blob) => (code ? identityClient.uploadShareCard(code, card) : Promise.resolve()),
    failed: owner !== null && made.isError,
    retry: () => void made.refetch(),
  };
};

export const useShareLink = (moment: DayShareMoment) =>
  useMadeLink(["link", moment.kind, moment.chainId, moment.gameId, moment.moment], async () => ({
    code: await identityClient.createShare(moment),
  }));

export const useOwnInvite = () => {
  const pledged = useOrderIntent().intent.data?.order ?? null;
  const invite = useMadeLink(["invite", pledged], async () => {
    const made = await identityClient.createInvite();
    return made && { ...made, aspect: catalogAspectId(made.aspect) };
  });
  return { ...invite, aspect: invite.link?.aspect ?? null, none: invite.link === null };
};

/** What the account's shared links brought; null without an account, while it is read, or when identity cannot say. */
export const useShareTally = (): ShareTally | null => {
  const owner = useShareOwner();
  const tally = useQuery({
    queryKey: [OWN_SHARES, owner, "tally"],
    queryFn: () => identityClient.shareTally(),
    enabled: owner !== null,
    retry: false,
  });
  return owner !== null && tally.status === "success" ? tally.data : null;
};

export const useInvitedFriends = (): InvitedFriends["friends"] | null => {
  const owner = useShareOwner();
  const friends = useQuery({
    queryKey: [OWN_SHARES, owner, "friends"],
    queryFn: () => identityClient.invitedFriends(),
    enabled: owner !== null,
    retry: false,
  });
  return owner !== null && friends.status === "success" ? friends.data.friends : null;
};

/** What is known of the link the account came by: being read, unreadable (with a way to ask again), or read. */
type JoinedShareReading =
  | { status: "loading" }
  | { status: "failed"; retry: () => void }
  | { status: "ready"; joined: JoinedShare };

/**
 * The link the signed-in account came by, read once per account: loading until identity answers, failed when it cannot
 * say, ready with the link (null when none brought the account). Without an account there is nothing to read. Another
 * account's answer is never reused.
 */
export const useJoinedShare = (): JoinedShareReading => {
  const owner = useShareOwner();
  const joined = useQuery({
    queryKey: [OWN_SHARES, owner, "joined"],
    queryFn: () => identityClient.joinedShare(),
    enabled: owner !== null,
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1,
  });
  if (owner === null) return { status: "ready", joined: null };
  if (joined.status === "success") return { status: "ready", joined: joined.data };
  if (joined.status === "error") return { status: "failed", retry: () => void joined.refetch() };
  return { status: "loading" };
};
